var Promise = require("bluebird");

module.exports = function streamClosedAsync(stream) {
  return new Promise(function(resolve, reject) {
    stream.on("closed", function() {
      resolve();
    });
  });
}