var Promise = require("bluebird");
var fs = Promise.promisifyAll(require("fs-extra"));

module.exports = function isNotDirectory(path) {
  return Promise.try(function() {
    return fs.lstatAsync(path);
  }).then(function(stat) {
    return (stat.isDirectory() === false);
  });
}