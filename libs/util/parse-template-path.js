var path = require("path");

module.exports = function(env) {
  return function parseTemplatePath(templatePath) {
    var directory = path.dirname(templatePath).replace(env.environmentPath(""), "");
    var extension = path.extname(templatePath);
    var filename = path.basename(templatePath);
    var basename = path.basename(templatePath, extension);
    var isRaw = /\.raw$/.test(basename);

    return {
      directory: directory,
      extension: extension,
      filename: filename,
      basename: basename,
      isRaw: isRaw
    }
  }
}