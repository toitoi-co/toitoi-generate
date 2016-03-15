var Promise = require("bluebird");

module.exports = function streamEndedAsync(stream) {
  return new Promise(function(resolve, reject) {
    stream.on("end", function() {
      resolve();
    });
  });
}