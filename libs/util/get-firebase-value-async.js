var Promise = require("bluebird");

module.exports = function getFirebaseValueAsync(ref) {
  return new Promise(function(resolve, reject) {
    ref.once("value", function(data) {
      resolve(data.val());
    }, function(error) {
      reject(error); // FIXME: Will this be an error object?
    })
  });
}