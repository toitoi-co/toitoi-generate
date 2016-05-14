var Promise = require("bluebird");
var urlJoin = require("url-join");
var fs = Promise.promisifyAll(require("fs"));
var path = require("path");
var globAsync = Promise.promisify(require("glob"));

var isNotDirectory = require("../util/is-not-directory");

module.exports = function renderPages(options) {
  var env = options.environment;

  var parseTemplatePath = require("../util/parse-template-path")(env);
  var writeTemplate = require("./write-template")({
    swigInstance: options.swigInstance,
    swigFunctions: options.swigFunctions,
    environment: env
  });

  return function() {
    return Promise.try(function() {
      env.logger.ok("Rendering pages");

      return Promise.all([
        options.prepareData(),
        globAsync(env.environmentPath("pages/**/*"))
      ]);
    }).spread(function(bucketData, paths) {
      return Promise.filter(paths, function(templatePath) {
        return isNotDirectory(templatePath);
      }).map(function(templatePath) {
        var pathSegments, urlSegments, noIndex;

        var parsedPath = parseTemplatePath(templatePath);

        var strippedDirectory = parsedPath.directory.replace(/^\/pages\/?/, "");

        if (parsedPath.isRaw) {
          urlSegments = [
            strippedDirectory,
            parsedPath.filename.replace(/\.raw$/, "") + parsedPath.extension
          ];

          pathSegments = urlSegments;
        } else if (parsedPath.extension === ".html" && parsedPath.basename !== "index" && parsedPath.filename !== "404.html") {
          urlSegments = [
            strippedDirectory,
            parsedPath.basename
          ];

          pathSegments = urlSegments.concat(["index.html"]);
        } else {
          urlSegments = [
            strippedDirectory,
            parsedPath.filename
          ];

          pathSegments = urlSegments;
        }

        var targetPath = env.buildPath(path.join.apply(path, pathSegments));
        var targetPath = env.buildPath(path.join.apply(path, pathSegments));
        var url = urlJoin.apply([""].concat(urlSegments));

        // FIXME: Why these particular types? Shouldn't this be an option?
        var templateables = [".html", ".xml", ".rss", ".xhtml", ".atom", ".txt"];

        if (parsedPath.extension !== "html" || parsedPath.filename === "404.html") {
          noIndex = true;
        } else {
          noIndex = false;
        }

        if (templateables.indexOf(parsedPath.extension) !== -1) {
          return writeTemplate(templatePath, targetPath, url, options.prepareLocals({}), {
            noIndex: noIndex
          });
        } else {
          return Promise.try(function() {
            return fs.mkdirsAsync(path.dirname(targetPath));
          }).then(function() {
            return fs.copyAsync(templatePath, targetPath);
          });
        }
      }).then(function() {
        env.logger.ok("Finished rendering pages");
      })
    });
  }
}