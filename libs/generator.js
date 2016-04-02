'use strict';

var Promise = require("bluebird");
var extend = require("extend");
var xtend = require("xtend");
var bhttp = require("bhttp");
var devNull = require("dev-null");
var taskQueue = require("promise-task-queue");
var urlJoin = require("url-join");
var FirebaseTokenGenerator = require("firebase-token-generator");
var temp = Promise.promisifyAll(require("temp"));
var extractZipAsync = Promise.promisify(require("extract-zip"));
var util = require("util");
var dotty = require("dotty");
var promiseWhile = require("promise-while-loop");
var WebSocket = require("ws");
var gm = require("gm");

var express = require("express");
var expressWs = require("@joepie91/express-ws");
var expressPromiseRouter = require("express-promise-router");

var Firebase = require('firebase');
var path = require('path');
var fs = Promise.promisifyAll(require('fs-extra'));
var glob = require('glob');
var cheerio = require('cheerio');
var swig = require('swig');

var createSlugGenerator = require("./util/generate-slug");
var createItemSlugGenerator = require("./util/get-item-slug");
var createRequestVerifier = require("./util/auth/verify-signed-request");
var createFirebaseTokenVerifier = require("./util/auth/verify-firebase-token");
var createViewTokenVerifier = require("./util/auth/verify-view-token");
var createManifestDiffer = require("./util/diff-manifest");
var createFirebaseTokenMiddleware = require("./middleware/firebase-token-auth");
var createViewTokenMiddleware = require("./middleware/view-token-auth");

var errors = require("./util/errors");

var concatStreamAsync = require("./util/concat-stream-async");
var createReadStreamAsync = require("./util/create-read-stream-async");
var createWriteStreamAsync = require("./util/create-write-stream-async");
var streamClosedAsync = require("./util/stream-closed-async");
var streamEndedAsync = require("./util/stream-ended-async");
var getFirebaseValueAsync = require("./util/get-firebase-value-async");
var escapeKey = require("./util/escape-key");
var npmWrapper = require("./util/npm-wrapper");
var isNotDirectory = require("./util/is-not-directory");
var isPublished = require("./util/is-published");
var formatCustomUrl = require("./util/format-custom-url");
var defaultValue = require("./util/default-value");
var suffixBasename = require("./util/suffix-basename");
var generateThumbnailSuffix = require("./util/generate-thumbnail-suffix");
var getImageMetadata = require("./util/get-image-metadata")

var globAsync = Promise.promisify(glob);
Promise.promisifyAll(gm.prototype);

require('colors');

temp.track(); // Automatically cleans up temporary directories.

var debugMode = (process.env.NODE_DEBUG != null && /(^|,)generate($|,)/.test(process.env.NODE_DEBUG))

var loggerPrefix = "[x] ";
var logger = logger || {
  ok: function(data) {
    console.log(loggerPrefix + data);
  },
  error: function(data) {
    console.error(loggerPrefix + data);
  },
  debug: function(data) {
    if (debugMode) {
      console.error(loggerPrefix + data);
    }
  },
  write: function() {},
  writeln: function() {}
};

logger.debug("Debug mode enabled.")

// FIXME: This is VERY questionable code, and will NOT provide secure sandboxing.
var wrap = function()
{
  var args = Array.prototype.slice.call(arguments);

  var last = args.pop();
  last = 'debugger;' +
         'var global = null;' +
         'var console = null;' +
         'var v8debug = null;' +
         'var setTimeout = null;' +
         'var setInterval = null;' +
         'var setImmediate = null;' +
         'var clearTimeout = null;' +
         'var clearInterval = null;' +
         'var clearImmediate = null;' +
         'var root = null;' +
         'var GLOBAL = null;' +
         'var window = null;' +
         'var process = null;' +
         'var eval = null;' +
         'var require = null;' +
         'var __filename = null;' +
         'var __dirname = null;' +
         'var modules = null;' +
         'var exports = null;' +
         last;

  args.push(last);

  return Function.prototype.constructor.apply(this, args);
};
wrap.prototype = Function.prototype;
Function = wrap;

var localConfig = require("../config.json");

var firebaseToken = (new FirebaseTokenGenerator(localConfig.firebaseKey)).createToken({
	uid: "-generate"
}, {
	expires: Date.now() + 31536000, // FIXME: Add reauthentication logic
	admin: true
});

var firebaseRoot = new Firebase("https://" + localConfig.firebaseName + ".firebaseio.com/");
var authPromise = firebaseRoot.authWithCustomToken(firebaseToken);

var verifySignedRequest = createRequestVerifier(localConfig.firebaseKey);
var verifyFirebaseToken = createFirebaseTokenVerifier(firebaseRoot, localConfig.firebaseKey);
var verifyViewToken = createViewTokenVerifier(firebaseRoot, localConfig.firebaseKey);

var viewTokenAuth = createViewTokenMiddleware(verifyViewToken);
var firebaseTokenAuth = createFirebaseTokenMiddleware(verifyFirebaseToken);

var environments = {};

function getEnvironment(siteName) { // REFACT: Memoize?
  return Promise.try(function() {
    if (environments[siteName] != null) {
      return environments[siteName];
    } else {
      return Promise.try(function() {
        getFirebaseValueAsync(firebaseRoot.child("management/sites/" + escapeKey(siteName) + "/key"))
      }).then(function(secretKey) {
        secretKey = "somebucketsecretkey"; // REFACT: Override because of issues with getting it from Firebase. To fix...
        return createEnvironment({
          strictMode: true,
          siteName: siteName,
          secretKey: secretKey,
          noSearch: false,
          firebaseName: localConfig.firebaseName,
          embedlyKey: localConfig.embedlyKey,
          webhookServer: localConfig.webhookServer
        })
      }).tap(function(environment) {
        environments[siteName] = environment;
      });
    }
  })
}

function createEnvironment(environmentOptions) {
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
    return path.join(__dirname, "../sites", environmentOptions.siteName, targetPath);
  }
  
  var loggerPrefix = "[" + environmentOptions.siteName + "] ";
  var logger = logger || {
    ok: function(data) {
      console.log(loggerPrefix + data);
    },
    error: function(data) {
      console.error(loggerPrefix + data);
    },
    debug: function(data) {
      if (debugMode) {
        console.error(loggerPrefix + data);
      }
    },
    write: function() {},
    writeln: function() {}
  };
  
  return Promise.try(function() {
    logger.ok('Creating new environment...');
    
    return fs.mkdirsAsync(environmentPath(""))
  }).then(function() {
    var queue = taskQueue();

    queue.define("build", function(task) {
      // FIXME: Ignoring build type for now, does it matter?
      return doBuild(task);
    });

    queue.define("resize", function(task) {
      // task:
      //   * type: "resize" / "crop"
      //   * source: filename
      //   * size: {width, height}

      var thumbnailBasename = suffixBasename(task.source, generateThumbnailSuffix(task));
      var thumbnailPath = environmentPath(path.join("static/thumbnails", thumbnailBasename));
      var sourcePath = environmentPath(path.join("static/images", task.source));

      return Promise.try(function() {
        // Code smell, but probably the only way to do this without wasting resources...
        return fs.statAsync(thumbnailPath);
      }).then(function(stat) {
        // The resized image already exists.
        logger.debug("Image " + task.source + " already exists, skipping resize task...");
        return;
      }).catch({code: "ENOENT"}, function(err) {
        logger.debug("Resizing " + task.source + "...");
        return Promise.try(function() {
          return Promise.all([
            createReadStreamAsync(sourcePath),
            fs.mkdirsAsync(environmentPath("static/thumbnails"))
          ]);
        }).spread(function(sourceStream, _unused) {
          var resizeHost = "http://" + localConfig.resize.server; // FIXME: TLS
          var endpoint = urlJoin(resizeHost, task.type);

          return bhttp.post(endpoint, {
            image: sourceStream,
            width: task.size.width.toString(),
            height: task.size.height.toString()
          }, {
            stream: true,
            headers: {
              "x-connection-key": localConfig.resize.connectionKey
            }
          });
        }).then(function(response) {
          if (response.statusCode === 200) {
            // FIXME: Potential race condition.
            logger.debug("Saving resized image to " + thumbnailPath + "...");
            response.pipe(fs.createWriteStream(thumbnailPath));
            return streamEndedAsync(response);
          } else {
            // FIXME: Proper error types.
            return Promise.try(function() {
              return concatStreamAsync(response);
            }).then(function(errorBody) {
              throw new Error(errorBody);
            });
          }
        })
      })
    })

    var swigInstance = new swig.Swig({
      loader: swig.loaders.fs(environmentPath("")),
      cache: false // FIXME: 'memory' for production?
    });
    
    function buildPath(targetPath) {
      return environmentPath(path.join(".build", targetPath));
    }

    function buildDirectoryPath(targetPath) {
      return buildPath(path.join(targetPath, "index.html"));
    }

    var swigFunctions = new require('./swig_functions').swigFunctions({
      queue: queue
    });

    var swigFilters = require('./swig_filters');
    var swigTags = require('./swig_tags');
    swigFilters.init(swigInstance, {
      queue: queue
    }); // Doesn't keep around any globals
    swigTags.init(swigInstance); // Doesn't do anything yet

    /**
     * Used to get the bucket were using (combinaton of config and environment)
     */
    function getBucketRef() {
      return firebaseRoot.child('buckets/' + escapeKey(environmentOptions.siteName) + '/' + environmentOptions.secretKey + '/dev');
    };

    function getBucketData() {
      return getFirebaseValueAsync(getBucketRef());
    }

    function getTypeData(type) {
      return Promise.try(function() {
        return getFirebaseValueAsync(getBucketRef().child(type))
      });
    }

    /**
     * Used to get the dns information about a site (used for certain swig functions)
     */
    function getDnsRef() {
      return firebaseRoot.child('management/sites/' + escapeKey(environmentOptions.siteName) + '/dns');
    };

    function getDnsData() {
      return getFirebaseValueAsync(getDnsRef());
    }

    function extractData(bucketData) {
      var typeInfo, settings, content;

      if (bucketData == null) {
        typeInfo = {};
        settings = {};
        content = {};
      } else {
        if (bucketData.contentType != null) {
          typeInfo = bucketData.contentType;
        } else {
          typeInfo = {};
        }

        if (bucketData.data != null) {
          content = bucketData.data;
        } else {
          content = {};
        }

        if (bucketData.settings != null) {
          settings = bucketData.settings;
        } else {
          settings = {};
        }
      }

      return {
        data: content,
        typeInfo: typeInfo,
        settings: settings
      }
    }

    var cachedData;

    function getData() { // FIXME: Memoize?
      return Promise.try(function() {
        logger.ok('Retrieving site data...');
        if (cachedData != null) {
          return cachedData;
        } else {
          return Promise.all([
            getBucketData(),
            getDnsData()
          ]).spread(function(bucketData, dnsData) {
            // REFACT: `dnsData` is actually `domainName`, and may not even be used in our case...
            if (dnsData == null) {
              dnsData = environmentOptions.siteName + ".webhook.org";
            }

            cachedData = extend({
              siteDns: dnsData
            }, extractData(bucketData));

            return cachedData;
          });
        }
      })
    }

    function prepareData() { // FIXME: This returns data *and* has side-effects, but shouldn't...
      return Promise.try(function() {
        return getData();
      }).then(function(bucketData) {
        swigFunctions.setData(bucketData.data);
        swigFunctions.setTypeInfo(bucketData.typeInfo);
        swigFunctions.setSettings(bucketData.settings);
        swigFilters.setSiteDns(bucketData.siteDns);
        swigFilters.setFirebaseConf(environmentOptions.webhookConfig);
        swigFilters.setTypeInfo(bucketData.typeInfo);

        return bucketData;
      });
    }

    // FIXME: This needs refactoring into transform streams, but that's not a priority right now.
    var searchEntryStream;

    function openSearchEntryStream() {
      return; // REFACT: Disabled because of issues with streamClosedAsync...
      return Promise.try(function() {
        logger.ok('Creating search stream...');
        if (environmentOptions.noSearch) {
          return;
        } else {
          return Promise.try(function() {
            return fs.mkdirsAsync(buildPath(".wh/"));
          }).then(function() {
            searchEntryStream = fs.createWriteStream(buildPath(".wh/searchjson.js"));
            searchEntryStream.write('var tipuesearch = {"pages": [\n');
          });
        }
      })
    }

    function closeSearchEntryStream() {
      return; // REFACT: Disabled because of issues with streamClosedAsync...
      return Promise.try(function() {
        logger.ok('Closing search stream...');
        if (environmentOptions.noSearch || searchEntryStream == null) {
          return;
        } else {
          return Promise.try(function() {
            searchEntryStream.end("]}");
            return streamClosedAsync(searchEntryStream);
          })
        }
      });
    }

    function writeSearchEntry(url, output) {
      return; // REFACT: Disabled because of issues with Cheerio...
      
      if (environmentOptions.noSearch || searchEntryStream == null) {
        return;
      } else {
        var $ = cheerio.load(output);

        var title = $("title").text();
        var body = $("body");

        if (body.attr("data-search-index") === "false") {
          // Page indicates that it should not be indexed.
          return;
        } else {
          var targetBody;
          var fakeBody = body.find('[data-search-index="true"]');

          if (fakeBody.length > 0) {
            targetBody = fakeBody.first();
          } else {
            targetBody = body;
          }

          var ignorables = [
            "script",
            "iframe",
            "object",
            '[data-search-index="false"]'
          ];

          ignorables.forEach(function(ignorableSelector) {
            targetBody.find(ignorableSelector).remove();
          });

          var bodyText = targetBody.text().trim();
          var keywordTags = $('meta[name="keywords"]');
          var tags;

          if (keywordTags.length > 0) {
            tags = keywordTags.attr("content");
          }

          var searchItem = {
            title: title,
            text: bodyText,
            tags: tags,
            loc: url
          }

          searchEntryStream.write(JSON.stringify(searchItem) + ",\n");
        }
      }
    }

    function tryRender(template, locals, options) {
      logger.ok('Rendering ' + template);
      
      var renderedOutput;

      try {
        renderedOutput = swigInstance.renderFile(template, locals);
      } catch (err) {
        // REFACT: Replace sendSockMessage, somehow... maybe specify a hook in `options`?

        if (options.strictMode) {
          throw err;
        } else {
          /* Render an error page. */
          // REFACT: Debug logging.

          try {
            renderedOutput = swigInstance.renderFile("./debug500.html", {
              template: template,
              error: err.toString(),
              backtrace: err.stack.toString()
            });
          } catch (err) {
            throw err; // REFACT: Will this break stuff? Original code returned empty string... magic value?
          }
        }
      }
      
      return renderedOutput;
    }

    function writeTemplate(template, destination, url, locals, options) { // REFACT: Function name
      return Promise.try(function() {
        
        if (locals == null) {
          locals = {};
        }
        
        if (options == null) {
          options = {};
        }

        extend(locals, swigFunctions.getFunctions(), {
          firebase_conf: environmentOptions.webhookConfig,
          cmsSocketPort: localConfig.listen.port,
          production: environmentOptions.production
        });

        swigFunctions.init(); // State reset?
        
        // REFACT: The following appears to have broken the build process...
        /*if (locals.item != null) {
          locals.item = locals._realGetItem(locals.item._type, locals.item._id, true); // FIXME: This is messy... what is it for?
        }*/

        return promiseWhile(function() {
          // Always render the first page.
          return (swigFunctions.shouldPaginate() || swigFunctions.curPage === 1);
        }, function() {
          var pageDestination, pageUrl;

          /* FIXME: The below logic ported from original code, but this won't create a page-1 file? */
          if (swigFunctions.shouldPaginate() && swigFunctions.curPage !== 1) {
            var pageSuffix = swigFunctions.pageUrl + swigFunctions.curPage;
            pageDestination = destination.replace("/index.html", "/" + pageSuffix + "/index.html");
            pageUrl = urlJoin(url, pageSuffix);
          } else {
            /* Single-page item. */
            pageDestination = destination;
            pageUrl = url;
          }

          swigFunctions.setParams({ CURRENT_URL: pageUrl });

          var output = tryRender(template, locals, {
            strictMode: environmentOptions.strictMode
          });

          return Promise.try(function() {
            return fs.mkdirsAsync(path.dirname(pageDestination));
          }).then(function() {
            logger.debug("Writing " + pageDestination);
            return fs.writeFileAsync(pageDestination, output);
          }).then(function() {
            if (!options.noIndex) {
              return writeSearchEntry(pageDestination, output);
            } else {
              return;
            }
          }).then(function() {
            swigFunctions.increasePage();

            return {
              destination: pageDestination,
              url: pageUrl
            };
          });
        });
      });
    }

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
          npm: localConfig.npm,
          path: path
        });

        if (localConfig.npmCache != null) {
          var oldCachePath;

          return Promise.try(function() {
            return npm.getCachePath();
          }).then(function(path) {
            oldCachePath = path;
            return npm.setCachePath(localConfig.npmCache);
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

    function parseTemplatePath(templatePath) {
      var directory = path.dirname(templatePath).replace(environmentPath(""), "");
      var extension = path.extname(templatePath);
      var filename = path.basename(templatePath);
      var basename = path.basename(templatePath, extension);
      var isRaw = /\.raw$/.test(basename);

      return {
        directory: directory,
        extension: extension,
        filename: filename,
        basename: basename,
        isRaw: isRaw
      }
    }

    function renderPages() {
      return Promise.try(function() {
        logger.ok("Rendering pages");

        return Promise.all([
          prepareData(),
          globAsync(environmentPath("pages/**/*"))
        ]);
      }).spread(function(bucketData, paths) {
        return Promise.filter(paths, function(templatePath) {
          return isNotDirectory(templatePath);
        }).map(function(templatePath) {
          var pathSegments, urlSegments, noIndex;

          var parsedPath = parseTemplatePath(templatePath);
          
          var strippedDirectory = parsedPath.directory.replace(/^\/pages\/?/, "");

          if (parsedPath.isRaw) {
            urlSegments = [
              strippedDirectory,
              parsedPath.filename.replace(/\.raw$/, "") + parsedPath.extension
            ];

            pathSegments = urlSegments;
          } else if (parsedPath.extension === ".html" && parsedPath.basename !== "index" && parsedPath.filename !== "404.html") {
            urlSegments = [
              strippedDirectory,
              parsedPath.basename
            ];

            pathSegments = urlSegments.concat(["index.html"]);
          } else {
            urlSegments = [
              strippedDirectory,
              parsedPath.filename
            ];

            pathSegments = urlSegments;
          }

          var targetPath = buildPath(path.join.apply(path, pathSegments));
          var url = urlJoin.apply([""].concat(urlSegments));

          // FIXME: Why these particular types? Shouldn't this be an option?
          var templateables = [".html", ".xml", ".rss", ".xhtml", ".atom", ".txt"];

          if (parsedPath.extension !== "html" || parsedPath.filename === "404.html") {
            noIndex = true;
          } else {
            noIndex = false;
          }

          if (templateables.indexOf(parsedPath.extension) !== -1) {
            return writeTemplate(templatePath, targetPath, url, {}, {
              noIndex: noIndex
            });
          } else {
            return Promise.try(function() {
              return fs.mkdirsAsync(path.dirname(targetPath));
            }).then(function() {
              return fs.copyAsync(templatePath, targetPath);
            });
          }
        }).then(function() {
          logger.ok("Finished rendering pages");
        })
      });
    }

    function getTemplateOverrideField(typeInfo) {
      if (typeInfo != null) {
        var layoutControls = typeInfo.controls.filter(function(control) {
          return (control.controlType === "layout");
        });

        if (layoutControls.length > 0) {
          return layoutControls[0].name;
        }
      }
    }

    function renderTemplates() {
      return Promise.try(function() {
        logger.ok('Rendering templates...');
        return Promise.all([
          prepareData(),
          globAsync(environmentPath("templates/**/*.html"))
        ]);
      }).spread(function(bucketData, paths) {
        var allTypeInfo = bucketData.typeInfo;
        var data = bucketData.data;

        var generateSlug = createSlugGenerator();
        var getItemSlug = createItemSlugGenerator(generateSlug);
        logger.ok('Rendering Templates');

        return Promise.filter(paths, function(templatePath) {
          var isPartial = (templatePath.indexOf(environmentPath("templates/partials")) === 0);
          var isTopLevel = (templatePath.replace(environmentPath("templates/"), "").split("/").length <= 1);
          var isLayout = /^\/templates\/[^\/]\/layouts\//.test(templatePath.replace(environmentPath(""), ""));
          return (!isPartial && !isTopLevel && !isLayout);
        }).map(function(templatePath) {
          var parsedPath = parseTemplatePath(templatePath);

          /* actualPath indices example:
           *  sites/foobar.com/templates/videogames/images/screenshots.html
           *                             ^ 0        ^ ...  ^ (length - 1)
           */
          var actualPath = templatePath.replace(environmentPath("templates/"), "");
          var actualPathSegments = actualPath.split("/");

          var itemType = actualPathSegments[0];
          var typeInfo = allTypeInfo[itemType];
          var templateOverrideField = getTemplateOverrideField(typeInfo);
          var typeData = defaultValue(data[itemType], {});

          var items = Object.keys(typeData).map(function(key) {
            return {
              key: key, // REFACT: Can we get rid of this?
              value: typeData[key]
            }
          });
          
          items.forEach(function(item) {
            item.value._type = itemType;
            item.value._id = item.key;
          });
          
          var categoryUrlSegments, itemUrlSegments;

          if (dotty.exists(typeInfo, "customUrls.listUrl")) {
            if (typeInfo.customUrls.listUrl === "#") {
              categoryUrlSegments = [ itemType ];
              itemUrlSegments = [];
            } else {
              categoryUrlSegments = [ typeInfo.customUrls.listUrl ];
              itemUrlSegments = [ typeInfo.customUrls.listUrl ];
            }
          } else {
            categoryUrlSegments = [ itemType ];
            itemUrlSegments = [ itemType ];
          }

          if (parsedPath.basename === "list") {
            var url = categoryUrlSegments.join("/");

            return writeTemplate(templatePath, buildDirectoryPath(url), "/" + url);
          } else if (parsedPath.basename === "individual") {
            return Promise.map(items, function(item) {
              var itemTemplatePath;

              if (templateOverrideField != null && item.value[templateOverrideField] != null) {
                /* A custom template was specified for this item. */
                var customTemplate = item.value[templateOverrideField];
                itemTemplatePath = environmentPath(path.join("templates", itemType, "layouts", customTemplate));
              } else {
                itemTemplatePath = templatePath;
              }

              var publishedRender;
              
              if (isPublished(item.value)) {
                var itemSlug = getItemSlug(item.value);
                var publishedUrl = itemUrlSegments.concat([itemSlug]).join("/");

                publishedRender = writeTemplate(itemTemplatePath, buildDirectoryPath(publishedUrl), "/" + publishedUrl, {item: item.value});
              }

              var previewUrl = urlJoin("_wh_previews", item.value.preview_url);

              return Promise.all([
                publishedRender,
                writeTemplate(itemTemplatePath, buildDirectoryPath(previewUrl), "/" + previewUrl, {item: item.value}, {
                  noIndex: true
                })
              ]);
            });
          } else {
            /* Sub-page templates... */
            return Promise.map(items, function(item) {
              if (isPublished(item.value)) {
                /* Using actualPathSegments, slice(1, -1):
                 *  sites/foobar.com/templates/videogames/more/images/screenshots.html
                 *                             ^ 0        ^ 1  ^ 2    ^ 3 (-1)
                 * Result: ["more", "images"]
                 */
                var itemSlug = getItemSlug(item.value);
                var subPagePathSegments = actualPathSegments.slice(1, -1).concat([parsedPath.basename]);
                var url = itemUrlSegments.concat([itemSlug]).concat(subPagePathSegments).join("/");

                // FIXME: Sub-pages are not rendered for previews? It was like this in the original code...
                return writeTemplate(templatePath, buildDirectoryPath(url), "/" + url, {item: item.value});
              }
            });
          }
        })
      }).then(function() {
        logger.ok("Finished rendering templates");
      })
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
        var socket = new WebSocket("ws://" + localConfig.deployment.server, {
          headers: {
            "x-connection-key": localConfig.deployment.connectionKey
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
          cachedData = null;

          return Promise.try(function() {
            return cleanFullBuild();
          }).then(function() {
            return openSearchEntryStream();
          }).then(function() {
            return renderTemplates();
          }).then(function() {
            // Ensure that all resizing tasks have completed, before we copy the static files.
            logger.ok("Waiting for image resizing tasks to complete...");
            return queue.awaitDrained("resize");
          }).then(function() {
            return copyStatic();
          }).then(function() {
            return renderPages();
          }).then(function() {
            return closeSearchEntryStream();
          }).then(function() {
            logger.ok("Build completed!");
            logger.ok("Starting deployment...");
            return deploy();
          }).tap(function() {
            logger.ok("Deployment completed!");
          });
          // REFACT: LiveReload
        } else {
          throw new Error("No such build type exists.");
        }
      })
    }
    
    return {
      getTypeData: getTypeData,
      queue: queue,
      installRemotePreset: installRemotePreset,
      installLocalPreset: installLocalPreset,
      path: environmentPath,
      queue: queue,
      bucketRef: getBucketRef
    }
  });
}

var app = express();
expressWs(app);

var router = expressPromiseRouter();

// FIXME: apiRouter
router.get("/images/:sitename", firebaseTokenAuth, function(req, res) {
  logger.debug("Listing images for " + req.params.sitename);

  return Promise.try(function() {
    return getEnvironment(req.params.sitename);
  }).then(function(environment) {
    return getFirebaseValueAsync(environment.bucketRef().child("images"));
  }).then(function(images) {
    res.send(images);
  });
});

router.get("/images/:sitename/:filename", viewTokenAuth, function(req, res) {

});

router.get("/thumbnails/:sitename/:filname", viewTokenAuth, function(req, res) {

});

router.put("/images/:sitename/:filename", firebaseTokenAuth, function(req, res) {
  logger.debug("Uploading image for " + req.params.sitename);

  return Promise.try(function() {
    return getEnvironment(req.params.sitename);
  }).then(function(environment) {
    var targetPath = environment.path(path.join("static/images", req.params.filename));

    var thumbnailTask = {
      type: "crop",
      source: req.params.filename,
      size: {
        width: 200,
        height: 200
      }
    }

    return Promise.try(function() {
      return fs.mkdirsAsync(environment.path("static/images"));
    }).then(function() {
      return createWriteStreamAsync(targetPath, {
        flags: "wx"
      });
    }).then(function(targetStream) {
      req.pipe(targetStream);
      return streamEndedAsync(req);
    }).then(function() {
      return getImageMetadata(targetPath);
    }).then(function(metadata) {
      var imageObject = {
        url: "/images/" + req.params.sitename + "/" + req.params.filename,
        thumbnailUrl: "/images/" + req.params.sitename + "/" + suffixBasename(req.params.filename, generateThumbnailSuffix(thumbnailTask)),
        filename: req.params.filename,
        siteUrl: "/images/" + req.params.filename,
        fileSize: metadata.filesize,
        width: metadata.width,
        height: metadata.height,
        thumbnails: [],
        croppedThumbnails: []
      }

      return Promise.try(function() {
        return environment.bucketRef().child("images").push(imageObject);
      }).then(function() {
        return environment.queue.push("resize", thumbnailTask);
      }).then(function() {
        res.status(201).json(imageObject);
      });
    }).catch({code: "EEXIST"}, function(err) {
      throw new errors.ConflictError("The specified file already exists.");
    });
  });
});

app.use(cors({
  origin: localConfig.corsOrigin
}));

app.use("/", router);

app.use(function(err, req, res, next) {
  // FIXME: In development mode only
  var statusCode;

  if (err.statusCode != null) {
    statusCode = err.statusCode;
  } else {
    statusCode = 500;
  }

  res.status(statusCode).json({
    error: err.stack
  });

  console.log(err.stack);
});

app.ws("/ws", function(sock, req) {
  logger.ok('Client connected!');
  
  var connectionAlive = true;

  sock.on('close', function() {
    logger.ok("Client disconnected!");
    connectionAlive = false;
  });

  function sendMessage(data) {
    if (connectionAlive) {
      sock.send(JSON.stringify(data))
    }
  }

  function sendResult(commandId, data) {
    var message = xtend(data, {
      messageType: "done",
      commandId: commandId
    });

    sendMessage(message);
  }

  function sendError(commandId, error) {
    var message = {
      messageType: "error",
      commandId: commandId,
      message: (error.message != null) ? error.message : error // FIXME: Do this in a nicer way?
    };

    sendMessage(message);
  }

  sock.on('error', function() {
    // FIXME: This should probably do something?
  })

  sock.on('message', function(string) {
    Promise.try(function() {
      var message = JSON.parse(string);
      
      return Promise.try(function() {
        return authPromise;
      }).then(function() {
        return getEnvironment(message.site);
      }).then(function(environment) {
        switch (message.messageType) {
          case "supportedMessages":
            // FIXME: This list seems out of date. Is this even still used anywhere?
            sendResult(message.commandId, {
              messages: [
                'supported_messages', 'push', 'build', 'preset', 'layouts', 'preset_localv2', 'generate_slug_v2'
              ]
            })
            break;
          case "generateSlugV2":
            return Promise.try(function() {
              return environment.getTypeData(message.type);
            }).then(function(typeInfo) {
              var fakeItem = {
                _type: message.type,
                name: message.name,
                publish_date: message.date
              };

              // FIXME: This will not prevent collisions! This appears to be the same in the original code...
              var generateSlug = createSlugGenerator();
              var getItemSlug = createItemSlugGenerator(generateSlug);

              return {
                slug: getItemSlug(fakeItem, typeInfo)
              }
            });
            break;
          case "build":
            return Promise.try(function() {
              return verifyFirebaseToken(message.token, message.site);
            }).then(function() {
              return environment.queue.push("build", {type: "all"});
            });
            break;
          case "preset":
			return Promise.try(function() {
              return verifySignedRequest("preset", message.site, message.signedRequest);
            }).then(function(signedMessage) {
              if (signedMessage.url != null) {
                return Promise.try(function() {
                  return environment.installRemotePreset(signedMessage.url);
                }).then(function(presetData) {
                  return { presetData: presetData };
                });
              } else if (signedMessage.data != null) {
                return Promise.try(function() {
                  return environment.installLocalPreset(signedMessage.data);
                }).then(function(presetData) {
                  return { presetData: presetData };
                });
              } else {
                throw new Error("Must specify either `url` or `data`.")
              }
            });
            break;
          default:
            throw new Error("No such `messageType` exists.")
            break;
        }
      }).then(function(result) {
        logger.ok("Completed client request: " + message.messageType + " // " + message.commandId);
        sendResult(message.commandId, result);
      }).catch(function(err) {
        // REFACT: Only disclose certain types of 'public' errors...
        logger.ok("Failed client request: " + message.messageType + " // " + message.commandId + " // " + err.message);
        logger.debug(err.stack);
        sendError(message.commandId, err);
      });
    }).catch(function(err) {
      // Something went wrong during parsing, so we don't have a commandId...
      logger.debug(err.stack);
      sendError(null, err);
    });
  });
})

app.listen(localConfig.listen.port, localConfig.listen.host, function() {
  logger.ok("API + WebSocket server listening...");
});
