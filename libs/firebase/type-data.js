var getFirebaseValueAsync = require("../util/get-firebase-value-async");

module.exports = function(firebaseRoot) {
  var bucketReference = require("./bucket-reference")(firebaseRoot);

  return function typeData(type) {
    return getFirebaseValueAsync(bucketReference().child("contentType").child(type));
  }
}