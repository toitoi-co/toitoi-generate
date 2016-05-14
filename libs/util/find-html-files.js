var Promise = require("bluebird");
var recursiveReaddirAsync = Promise.promisify(require("recursive-readdir"));
var path = require("path");

module.exports = function(directory) {
  return Promise.try(function() {
    return recursiveReaddirAsync(directory);
  }).filter(function(file) {
    return (path.extname(file) === ".html");
  });
}