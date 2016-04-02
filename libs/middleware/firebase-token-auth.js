var Promise = require("bluebird");
var errors = require("../util/errors")

module.exports = function(verifier) {
  return function firebaseTokenAuth(req, res, next) {
    return Promise.try(function() {
      if (req.headers["x-token"] == null) {
        throw new errors.TokenError("No authentication token was specified.") // FIXME: error type
      } else {
        return verifier(req.headers["x-token"], req.params.sitename);
      }
    }).then(function() {
      next();
    });
  }
}
