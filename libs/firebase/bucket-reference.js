var escapeKey = require("../util/escape-key");

module.exports = function(firebaseRoot) {
  return function getBucketRef(siteName, secretKey) {
    return firebaseRoot.child('buckets/' + escapeKey(siteName) + '/' + secretKey + '/dev');
  }
}