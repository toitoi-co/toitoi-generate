var Promise = require("bluebird");
var jwt = require("jsonwebtoken-promisified");
var getFirebaseValueAsync = require("../get-firebase-value-async");
var escapeKey = require("../escape-key");
var errors = require("../errors");

module.exports = function(firebase, firebaseSecret) {
	return function(token, site) {
		return Promise.try(function() {
			return Promise.all([
				getFirebaseValueAsync(firebase.child("management/sites/" + escapeKey(site) + "/owners")),
				jwt.verifyAsync(token, firebaseSecret)
			])
			return ;
		}).spread(function(owners, decodedToken) {
			if (owners == null) {
				throw new errors.TokenError("No such hostname exists.");
			}

			var ownerList = Object.keys(owners).map(function(key) {
				return owners[key];
			});

			if (ownerList.indexOf(decodedToken.d.email) === -1) {
				throw new errors.TokenError("Invalid token.");
			}
		})
	}
}
