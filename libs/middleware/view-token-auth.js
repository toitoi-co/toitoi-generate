var Promise = require("bluebird");
var errors = require("../util/errors")

module.exports = function(verifier) {
  return function viewTokenAuth(req, res, next) {
    return Promise.try(function() {
      if (req.query.token == null) {
        throw new errors.TokenError("No authentication token was specified.") // FIXME: error type
      } else {
        console.log("TOKEN", req.query.token);
        return verifier(req.query.token, req.params.sitename);
      }
    }).then(function() {
      next();
    });
  }
}
