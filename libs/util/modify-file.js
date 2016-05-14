var Promise = require("bluebird");
var fs = Promise.promisifyAll(require("fs-extra"));

module.exports = function(filename, cb) {
  return Promise.try(function() {
    return fs.readFileAsync(filename);
  }).then(function(data) {
    var result = cb(data.toString());

    if (typeof result !== "string") {
      throw new Error("Callback must return a string");
    }

    return fs.writeFileAsync(filename, new Buffer(result));
  });
}