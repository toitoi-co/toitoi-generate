var getFirebaseValueAsync = require("../util/get-firebase-value-async");

module.exports = function(firebaseRoot) {
  var dnsReference = require("./dns-reference")(firebaseRoot);

  return function dnsData(siteName) {
    return getFirebaseValueAsync(dnsReference(siteName));
  }
}