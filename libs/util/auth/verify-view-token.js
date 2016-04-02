var Promise = require("bluebird");
var jwt = require("jsonwebtoken-promisified");
var errors = require("../errors");

module.exports = function(firebaseSecret) {
	return function(token, site) {
		return Promise.try(function() {
			return jwt.verifyAsync(token, firebaseSecret);
		}).then(function(decodedToken) {
			if (decodedToken.sitename !== site) {
				throw new errors.TokenError("Invalid token.");
			}
		})
	}
}
