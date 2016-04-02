var Promise = require("bluebird");
var jwt = require("jsonwebtoken-promisified");
var createError = require("create-error");

TypeMismatchError = createError("TypeMismatchError", {
	code: "TypeMismatchError"
});

HostnameMismatchError = createError("HostnameMismatchError", {
	code: "HostnameMismatchError"
});

module.exports = function(key) {
	return function(type, hostname, token) {
		return Promise.try(function() {
			return jwt.verifyAsync(token, key);
		}).then(function(token) {
			if (token.messageType == null || token.messageType !== type) {
				throw new TypeMismatchError("`messageType` did not match the requested operation.");
			} else if (token.hostname !== hostname) {
				throw new HostnameMismatchError("`hostname` did not match the requested hostname.");
			} else {
				return token;
			}
		});
	}
}
