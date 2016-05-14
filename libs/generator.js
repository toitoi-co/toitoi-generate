'use strict';

var Promise = require("bluebird");
var xtend = require("xtend");
var FirebaseTokenGenerator = require("firebase-token-generator");
var util = require("util");
var WebSocket = require("ws");

var express = require("express");
var expressWs = require("@joepie91/express-ws");
var expressPromiseRouter = require("express-promise-router");
var pathToRegexp = require("path-to-regexp");

var Firebase = require('firebase');
var path = require('path');
var fs = Promise.promisifyAll(require('fs-extra'));
var cors = require('cors');

var createSlugGenerator = require("./util/generate-slug");
var createItemSlugGenerator = require("./util/get-item-slug");
var createRequestVerifier = require("./util/auth/verify-signed-request");
var createFirebaseTokenVerifier = require("./util/auth/verify-firebase-token");
var createViewTokenVerifier = require("./util/auth/verify-view-token");
var createViewTokenGenerator = require("./util/auth/generate-view-token");
var createFirebaseTokenMiddleware = require("./middleware/firebase-token-auth");
var createViewTokenMiddleware = require("./middleware/view-token-auth");

var errors = require("./util/errors");

var createWriteStreamAsync = require("./util/create-write-stream-async");
var streamEndedAsync = require("./util/stream-ended-async");
var getFirebaseValueAsync = require("./util/get-firebase-value-async");
var escapeKey = require("./util/escape-key");
var suffixBasename = require("./util/suffix-basename");
var generateThumbnailSuffix = require("./util/generate-thumbnail-suffix");
var getImageMetadata = require("./util/get-image-metadata")
var wrapParams = require("./util/wrap-params");
var bucketReference = require("./firebase/bucket-reference");

/* FIXME: Post-modularization dependencies */
var createLogger = require("./util/logger");
var createEnvironment = require("./environment/create");

require('colors');

var debugMode = (process.env.NODE_DEBUG != null && /(^|,)generate($|,)/.test(process.env.NODE_DEBUG))

var logger = createLogger(null, {debugMode: debugMode});
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
var verifyViewToken = createViewTokenVerifier(localConfig.firebaseKey);
var generateViewToken = createViewTokenGenerator(localConfig.firebaseKey, localConfig.imageToken.expiry);

var viewTokenAuth = createViewTokenMiddleware(verifyViewToken);
var firebaseTokenAuth = createFirebaseTokenMiddleware(verifyFirebaseToken);

var environments = {};

function getEnvironment(siteName) { // REFACT: Memoize?
  return Promise.try(function() {
    if (environments[siteName] != null) {
      return environments[siteName];
    } else {
      return Promise.try(function() {
        return getFirebaseValueAsync(firebaseRoot.child("management/sites/" + escapeKey(siteName) + "/key"));
      }).then(function(secretKey) {
        logger.debug("Secret key for " + siteName + " according to Firebase: " + secretKey);
        return createEnvironment({
          strictMode: true,
          siteName: siteName,
          secretKey: secretKey,
          noSearch: false,
          firebaseName: localConfig.firebaseName,
          firebaseRoot: firebaseRoot,
          embedlyKey: localConfig.embedlyKey,
          webhookServer: localConfig.webhookServer,
          debugMode: debugMode,
          config: localConfig
        })
      }).tap(function(environment) {
        environments[siteName] = environment;
      });
    }
  })
}

var app = express();
expressWs(app);

var router = expressPromiseRouter();

// FIXME: apiRouter
router.get("/images/:sitename", firebaseTokenAuth, function(req, res) {
  logger.debug("Listing images for " + req.params.sitename);

  return Promise.try(function() {
    // FIXME: Move this to a .param middleware
    return getEnvironment(req.params.sitename);
  }).then(function(environment) {
    return getFirebaseValueAsync(environment.bucketRef().child("images"));
  }).then(function(images) {
    res.send(images);
  });
});

function createFileServer(basePath) {
  return function(req, res) {
    return Promise.try(function() {
      return getEnvironment(req.params.sitename);
    }).then(function(environment) {
      var filePath = environment.path(path.join(basePath, req.params.filename));
      res.sendFile(filePath);
    });
  }
}

var previewRoute = pathToRegexp("/preview/:sitename/:filename(.*)");
router.get(previewRoute, wrapParams(previewRoute, createFileServer("previews")));

/* To redirect slash-less requests, due to how RegExp-based routes work: */
router.get("/preview/:sitename/:previewKey", function(req, res, next) {
  res.redirect(req.path + "/");
});

router.get("/images/:sitename/:filename", viewTokenAuth, createFileServer("static/images"));
router.get("/thumbnails/:sitename/:filename", viewTokenAuth, createFileServer("static/thumbnails"));

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
        thumbnailUrl: "/thumbnails/" + req.params.sitename + "/" + suffixBasename(req.params.filename, generateThumbnailSuffix(thumbnailTask)),
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

  // FIXME: Figure out a way to do this for specific routes; sendFile will not let us .catch these...
  if (err.code === "ENOENT") {
    err = new errors.NotFoundError("No such file exists.");
  }

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
              return environment.queue.push("build", {type: "all", preview: message.preview});
            });
            break;
          case "publish":
            var bucket = bucketReference(firebaseRoot)(message.site, environment.secretKey);

            return Promise.try(function() {
              return verifyFirebaseToken(message.token, message.site);
            }).then(function() {
              return getFirebaseValueAsync(bucket.child("previewData"));
            }).then(function(data) {
              return bucket.child("data").set(data);
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
          case "imageToken":
            return Promise.try(function() {
              return verifyFirebaseToken(message.token, message.site);
            }).then(function() {
              return generateViewToken(message.site);
            }).then(function(token) {
              return {
                imageToken: token
              };
            })
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
        console.log(err.stack);
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
