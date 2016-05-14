var Promise = require("bluebird");
var path = require("path");
var fs = Promise.promisifyAll(require("fs-extra"));
var bhttp = require("bhttp");
var urlJoin = require("url-join");
var extend = require("extend");

var suffixBasename = require("../util/suffix-basename");
var generateThumbnailSuffix = require("../util/generate-thumbnail-suffix");
var createReadStreamAsync = require("../util/create-read-stream-async");
var streamEndedAsync = require("../util/stream-ended-async");
var concatStreamAsync = require("../util/concat-stream-async");

module.exports = function(options) {
  var env = options.environment;
  var config = options.config;

  return function(task) {
    // task:
    //   * type: "resize" / "crop"
    //   * source: filename
    //   * size: {width, height}

    var thumbnailBasename = suffixBasename(task.source, generateThumbnailSuffix(task));
    var thumbnailPath = env.environmentPath(path.join("static/thumbnails", thumbnailBasename));
    var sourcePath = env.environmentPath(path.join("static/images", task.source));

    return Promise.try(function() {
      // Code smell, but probably the only way to do this without wasting resources...
      return fs.statAsync(thumbnailPath);
    }).then(function(stat) {
      // The resized image already exists.
      env.logger.debug("Image " + path.basename(thumbnailPath) + " already exists, skipping resize task...");
      return;
    }).catch({code: "ENOENT"}, function(err) {
      env.logger.debug("Resizing " + task.source + "...");
      return Promise.try(function() {
        return Promise.all([
          createReadStreamAsync(sourcePath),
          fs.mkdirsAsync(env.environmentPath("static/thumbnails"))
        ]);
      }).spread(function(sourceStream, _unused) {
        var resizeHost = "http://" + config.resize.server; // FIXME: TLS
        var endpoint = urlJoin(resizeHost, task.type);

        var params = {};

        if (task.size.width != null) {
          params.width = task.size.width.toString();
        }

        if (task.size.height != null) {
          params.height = task.size.height.toString();
        }

        return bhttp.post(endpoint, extend(params, {
          image: sourceStream
        }), {
          stream: true,
          headers: {
            "x-connection-key": config.resize.connectionKey
          }
        });
      }).then(function(response) {
        if (response.statusCode === 200) {
          // FIXME: Potential race condition.
          env.logger.debug("Saving resized image to " + thumbnailPath + "...");
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
  }
}