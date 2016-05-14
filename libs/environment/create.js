var Promise = require("bluebird");
var path = require("path");
var fs = Promise.promisifyAll(require("fs-extra"));
var taskQueue = require("promise-task-queue");
var extend = require("extend");
var bhttp = require("bhttp");
var temp = Promise.promisifyAll(require("temp"));
var devNull = require("dev-null");
var extractZipAsync = Promise.promisify(require("extract-zip"));
var WebSocket = require("ws");
var uuid = require("uuid");
var urlJoin = require("url-join");

var createLogger = require("../util/logger");
var npmWrapper = require("../util/npm-wrapper");
var streamEndedAsync = require("../util/stream-ended-async");
var createManifestDiffer = require("../util/diff-manifest");
var createUrlPatcher = require("../util/patch-urls");
var findHtmlFiles = require("../util/find-html-files");

temp.track(); // Automatically cleans up temporary directories.

module.exports = function createEnvironment(environmentOptions) {
  var bucketReference = require("../firebase/bucket-reference")(environmentOptions.firebaseRoot);
  var typeData = require("../firebase/type-data")(environmentOptions.firebaseRoot);

  // The following configuration object is for backwards compatibility reasons...
  environmentOptions.webhookConfig = {
    siteName: environmentOptions.siteName,
    secretKey: environmentOptions.secretKey,
    noSearch: environmentOptions.noSearch,
    firebase: environmentOptions.firebaseName,
    embedly: environmentOptions.embedlyKey,
    server: environmentOptions.webhookServer,
    custom: true
  }

  function environmentPath(targetPath) {
    return path.join(__dirname, "../../sites", environmentOptions.siteName, targetPath);
  }

  function buildPath(targetPath) {
    return environmentPath(path.join(".build", targetPath));
  }

  function buildDirectoryPath(targetPath) {
    return buildPath(path.join(targetPath, "index.html"));
  }

  var logger = createLogger(environmentOptions.siteName, {
    debugMode: environmentOptions.debugMode
  });

  var environmentAPI = {
    logger: logger,
    environmentPath: environmentPath,
    buildPath: buildPath,
    buildDirectoryPath: buildDirectoryPath,
    strictMode: environmentOptions.strictMode
  }

  return Promise.try(function() {
    logger.ok('Creating new environment...');

    return fs.mkdirsAsync(environmentPath(""))
  }).then(function() {
    var queue = taskQueue();

    queue.define("build", function(task) {
      // FIXME: Ignoring build type for now, does it matter?
      return doBuild(task);
    });

    queue.define("resize", require("./resize-task")({
      environment: environmentAPI,
      config: environmentOptions.config
    }));

    var createRenderer = require("../render/create")({
      environment: environmentAPI,
      environmentOptions: environmentOptions,
      config: environmentOptions.config,
      firebaseRoot: environmentOptions.firebaseRoot,
      queue: queue,
      secretKey: environmentOptions.secretKey,
      siteName: environmentOptions.siteName,
      webhookConfig: environmentOptions.webhookConfig
    });

    function getPresetData() {
      return Promise.try(function() {
        return fs.readFileAsync(environmentPath(".preset-data.json"));
      }).then(function(fileData) {
        return JSON.parse(fileData);
      }).catch({code: "ENOENT"}, function(err) {
        /* The preset archive did not contain any preset data. */
        return null;
      });
    }

    function importPackageDependencies() {
      return Promise.try(function() {
        return Promise.all([
          fs.readFileAsync(environmentPath("package.json")).reflect(),
          fs.readFileAsync(environmentPath("package.json.old")).reflect()
        ]);
      }).spread(function(packageJsonPromise, oldPackageJsonPromise) {
        if (packageJsonPromise.isFulfilled() && oldPackageJsonPromise.isFulfilled()) {
          /* Both files exist. */
          var packageJson = packageJsonPromise.value();
          var oldPackageJson = oldPackageJsonPromise.value();

          extend(packageJson.dependencies, oldPackageJson.dependencies);

          return Promise.all([
            fs.writeFileAsync(environmentPath("package.json"), JSON.stringify(packageJson, null, "  ")),
            fs.unlinkAsync(environmentPath("package.json.old"))
          ]);
        } else if (oldPackageJsonPromise.isFulfilled()) {
          /* Only the package.json.old exists - the new preset apparently didn't include one.' */
          return fs.renameAsync(environmentPath("package.json.old"), environmentPath("package.json"));
        } else {
          /* None of the presets used included a package.json - copy ours. */
          // REFACT: Is this actually necessary?
          return fs.copyAsync(path.join(__dirname, "../package.json"), environmentPath("package.json"));
        }
      });
    }

    function runNpm(path) {
      // FIXME: This will mess with the cache path, if configured, and could create conflicts with other things on the same system...
      return Promise.try(function() {
        var npm = npmWrapper({
          npm: environmentOptions.config.npm,
          path: path
        });

        if (environmentOptions.config.npmCache != null) {
          var oldCachePath;

          return Promise.try(function() {
            return npm.getCachePath();
          }).then(function(path) {
            oldCachePath = path;
            return npm.setCachePath(environmentOptions.config.npmCache);
          }).then(function() {
            return npm.install()
          }).then(function(){
            return npm.setCachePath(oldCachePath);
          });
        } else {
          return npm.install();
        }
      });
    }

    function extractGitHubZip(source, destination) {
      return Promise.try(function() {
        logger.debug("Creating temporary directory for preset unpacking");
        return temp.mkdirAsync("generate-preset");
      }).then(function(tempDir) {
        return Promise.try(function() {
          logger.debug("Extracting preset ZIP");
          return extractZipAsync(source, {dir: tempDir});
        }).then(function() {
          logger.debug("Locating base directory");
          return fs.readdirAsync(tempDir);
        }).then(function(entries) {
          logger.debug("Moving preset files to environment");
          var baseDirectory = path.join(tempDir, entries[0]);
          return fs.moveAsync(baseDirectory, destination, {clobber: true});
        }).then(function() {
          logger.debug("Removing temporary directory");
          return fs.removeAsync(tempDir);
        })
      });
    }

    function installPreset() {
      return Promise.try(function() {
        logger.ok('Installing preset...');
        logger.debug("Storing package.json backup");
        return Promise.try(function() {
          return fs.renameAsync(environmentPath("package.json"), environmentPath("package.json.old"));
        }).catch({code: "ENOENT"}, function(err) {
          logger.debug("No previous package.json found")
        });
      }).then(function() {
        logger.debug("Unpacking preset");

        return extractGitHubZip(environmentPath(".preset.zip"), environmentPath(""));
      }).then(function() {
        logger.debug("Importing dependencies");
        return importPackageDependencies();
      }).then(function(){
        logger.debug("Removing preset archive");
        return Promise.try(function(){
          return fs.unlinkAsync(environmentPath(".preset.zip"));
        }).catch({code: "ENOENT"}, function(err) {
          logger.debug("Preset archive was already removed");
        });
      }).then(function() {
        logger.debug("Running NPM");
        return runNpm(environmentPath(""));
      }).then(function() {
        logger.debug("Loading presetData");
        return getPresetData();
      }).tap(function() {
        logger.ok("Preset installed!");
	  });
    }

    function installRemotePreset(zipUrl) {
      return Promise.try(function() {
        logger.ok('Downloading preset...');

        return bhttp.get(zipUrl, {stream: true});
      }).then(function(response) {
        if (response.statusCode !== 200) {
          response.pipe(devNull()); // FIXME: Read and log the error?
          throw new Error("Non-200 status code encountered while downloading preset: " + response.statusCode);
        }

        logger.debug("Writing preset archive")
        response.pipe(fs.createWriteStream(environmentPath(".preset.zip")));

        return streamEndedAsync(response);
      }).then(function() {
        logger.debug("Writing preset archive finished")
        return installPreset();
      });
    }

    function installLocalPreset(fileData) {
      return Promise.try(function() {
        logger.ok('Storing base64ed preset...');

        return fs.writeFileAsync(environmentPath(".preset.zip"), fileData, {encoding: "base64"});
      }).then(function() {
        return installPreset();
      });
    }

    function copyStatic() {
      return Promise.try(function() {
        logger.ok('Copying static...');

        return fs.mkdirsAsync(buildPath("static"));
      }).then(function() {
        return fs.copyAsync(environmentPath("static"), buildPath("static"), {
          clobber: true
        });
      });
    }

    function deploy() {
      return new Promise(function(resolve, reject) {
        var diffManifest = createManifestDiffer(buildPath(""));

        // FIXME: Handle error when deployment server isn't running.
        var socket = new WebSocket("ws://" + environmentOptions.config.deployment.server, {
          headers: {
            "x-connection-key": environmentOptions.config.deployment.connectionKey
          }
        });

        socket.on("open", function() {
          function sendMessage(message) {
            socket.send(JSON.stringify(message));
          }

          socket.on("message", function(data) {
            var message = JSON.parse(data);

            switch(message.messageType) {
              case "hello":
                sendMessage({
                  messageType: "getManifest",
                  site: environmentOptions.siteName
                });
                break;
              case "manifest":
                var differ = diffManifest(message.manifest);

                differ.on("create", function(data) {
                  extend(data, {
                    messageType: "store",
                    site: environmentOptions.siteName
                  });
                  sendMessage(data);
                });

                differ.on("update", function(data) {
                  extend(data, {
                    messageType: "store",
                    site: environmentOptions.siteName
                  });
                  sendMessage(data);
                });

                differ.on("delete", function(data) {
                  extend(data, {
                    messageType: "delete",
                    site: environmentOptions.siteName
                  });
                  sendMessage(data);
                });

                differ.on("end", function() {
                  sendMessage({
                    messageType: "createSite",
                    site: environmentOptions.siteName
                  });
                })
                break;
              case "siteCreated":
                socket.close();
                resolve();
                break;
            }
          });
        });
      });
    }

    function cleanStaticBuild() {
      return Promise.try(function() {
        logger.ok('Cleaning static build...');
        return fs.removeAsync(buildPath("static"));
      });
    }

    function cleanFullBuild() {
      return Promise.try(function() {
        logger.ok('Cleaning full build...');
        return fs.removeAsync(buildPath(""));
      });
    }

    function doBuild(task) {
      return Promise.try(function() {
        logger.ok('Build initiated!');

        if (task.type === "static") {
          return Promise.try(function() {
            return cleanStaticBuild();
          }).then(function() {
            return copyStatic();
          });
          // REFACT: LiveReload
        } else if (task.type === "all") {
          var dataKey;

          if (task.preview === true) {
            dataKey = "previewData";
          } else {
            dataKey = "data";
          }
          var renderer = createRenderer(dataKey);

          return Promise.try(function() {
            return cleanFullBuild();
          }).then(function() {
            return renderer.renderTemplates();
          }).then(function() {
            // Ensure that all resizing tasks have completed, before we copy the static files.
            logger.ok("Waiting for image resizing tasks to complete...");
            return queue.awaitDrained("resize");
          }).then(function() {
            return copyStatic();
          }).then(function() {
            return renderer.renderPages();
          }).then(function() {
            logger.ok("Build completed!");
            if (task.preview === true) {
              var previewKey = uuid.v4();
              var previewPrefix = urlJoin("/preview/", environmentOptions.siteName, previewKey);
              var patchUrls = createUrlPatcher(previewPrefix);

              return Promise.try(function() {
                logger.ok("Patching URLs for preview...");
                return findHtmlFiles(buildPath(""));
              }).map(function(file) {
                logger.debug("Patching " + file);
                return patchUrls(file);
              }).then(function() {
                logger.ok("URL patching completed!");
                logger.ok("Copying preview build...");
                return fs.copyAsync(buildPath(""), environmentPath(path.join("previews", previewKey)));
              }).then(function() {
                logger.ok("Preview build copied!");
                return {previewKey: previewKey};
              });
            } else {
              return Promise.try(function() {
                logger.ok("Starting deployment...");
                return deploy();
              }).tap(function() {
                logger.ok("Deployment completed!");
              });
            }
          });
          // REFACT: LiveReload
        } else {
          throw new Error("No such build type exists.");
        }
      })
    }

    return {
      getTypeData: typeData, // FIXME: bind?
      queue: queue,
      installRemotePreset: installRemotePreset,
      installLocalPreset: installLocalPreset,
      path: environmentPath,
      queue: queue,
      bucketRef: bucketReference, // FIXME: bind?
      secretKey: environmentOptions.secretKey
    }
  });
}