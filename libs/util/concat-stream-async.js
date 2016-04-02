var Promise = require("bluebird");
var concatStream = require("concat-stream");

module.exports = function(stream) {
  return new Promise(function(resolve, reject) {
    stream.on("error", function(err) {
      reject(err);
    });

    stream.pipe(concatStream(function(result) {
      resolve(result);
    }));
  })
}
