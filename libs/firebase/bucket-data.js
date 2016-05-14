var getFirebaseValueAsync = require("../util/get-firebase-value-async");

module.exports = function(firebaseRoot) {
  var bucketReference = require("./bucket-reference")(firebaseRoot);

  return function bucketData(sitename, secretKey) {
    return getFirebaseValueAsync(bucketReference(sitename, secretKey));
  }
}