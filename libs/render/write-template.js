var Promise = require("bluebird");
var fs = Promise.promisifyAll(require("fs-extra"));
var path = require("path");
var defaultValue = require("default-value");
var promiseWhile = require("promise-while-loop");
var urlJoin = require("url-join");

module.exports = function(options) {
  var env = options.environment;
  var tryRender = require("./try-render")(env, options.swigInstance);

  return function writeTemplate(template, destination, url, locals, templateOptions) {
    return Promise.try(function() {
      locals = defaultValue(locals, {});
      options = defaultValue(options, {});

      options.swigFunctions.init(); // State reset?

      // REFACT: The following appears to have broken the build process...
      /*if (locals.item != null) {
        locals.item = locals._realGetItem(locals.item._type, locals.item._id, true); // FIXME: This is messy... what is it for?
      }*/

      return promiseWhile(function() {
        // Always render the first page.
        return (options.swigFunctions.shouldPaginate() || options.swigFunctions.curPage === 1);
      }, function() {
        var pageDestination, pageUrl;

        /* FIXME: The below logic ported from original code, but this won't create a page-1 file? */
        if (options.swigFunctions.shouldPaginate() && options.swigFunctions.curPage !== 1) {
          var pageSuffix = options.swigFunctions.pageUrl + options.swigFunctions.curPage;
          pageDestination = destination.replace("/index.html", "/" + pageSuffix + "/index.html");
          pageUrl = urlJoin(url, pageSuffix);
        } else {
          /* Single-page item. */
          pageDestination = destination;
          pageUrl = url;
        }

        options.swigFunctions.setParams({ CURRENT_URL: pageUrl });

        var output = tryRender(template, locals, {
          strictMode: env.strictMode
        });

        return Promise.try(function() {
          return fs.mkdirsAsync(path.dirname(pageDestination));
        }).then(function() {
          env.logger.debug("Writing " + pageDestination);
          return fs.writeFileAsync(pageDestination, output);
        }).then(function() {
          return;
        }).then(function() {
          options.swigFunctions.increasePage();

          return {
            destination: pageDestination,
            url: pageUrl
          };
        });
      });
    });
  }
}