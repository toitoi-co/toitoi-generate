var Promise = require("bluebird");
var fs = require("fs");

module.exports = function(path, options) {
  return new Promise(function(resolve, reject) {
    var stream = fs.createReadStream(path, options);

    var errorHandler = function(err) {
      reject(err);
    }

    stream.on("error", errorHandler);

    stream.on("open", function() {
      stream.removeListener("error", errorHandler);
      resolve(stream);
    })
  })
}
