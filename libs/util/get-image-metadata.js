var Promise = require("bluebird");
var gm = require("gm");
var fs = Promise.promisifyAll(require('fs-extra'));

Promise.promisifyAll(gm.prototype);

module.exports = function(imagePath) {
  return Promise.try(function() {
    return Promise.all([
      gm(imagePath).sizeAsync(),
      fs.statAsync(imagePath)
    ]);
  }).spread(function(size, stat) {
    return {
      width: size.width,
      height: size.height,
      filesize: stat.size
    }
  })
}
