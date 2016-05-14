var Promise = require("bluebird");
var modifyFile = require("./modify-file");

module.exports = function(prefix) {
  return function(filename) {
    return Promise.try(function() {
      return modifyFile(filename, function(contents) {
        /* FIXME: This should eventually be replaced with a proper HTML
         * parser/stringifier, but we need to investigate the way this
         * will deal with malformed HTML, and whether it might cause
         * unintended changes. */
        return contents.replace(/<([^>]+)(href|src)=('[^']+'|"[^"]+")/g, function(match, tagContents, attribute, attributeValue) {
          var url = attributeValue.slice(1, -1);
          var quote = attributeValue[0];
          var newUrl;

          /* Only modify if the URL is an absolute url, and not a
           * protocol-relative URL either. */
          if (url[0] === "/" && (url.length < 2 || url[1] !== "/")) {
            newUrl = prefix + url;
          } else {
            newUrl = url;
          }

          return "<" + tagContents + attribute + "=" + quote + newUrl + quote;
        });
      });
    });
  }
}