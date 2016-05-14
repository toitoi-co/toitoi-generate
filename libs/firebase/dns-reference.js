var escapeKey = require("../util/escape-key");

module.exports = function(firebaseRoot) {
  return function dnsReference(siteName) {
    return firebaseRoot.child('management/sites/' + escapeKey(siteName) + '/dns');
  }
}