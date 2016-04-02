var Promise = require("bluebird");
var jwt = require("jsonwebtoken-promisified");

module.exports = function(firebaseSecret, viewTokenExpiry) {
	return function(site) {
		return Promise.try(function() {
			return jwt.signAsync({
				sitename: site
			}, firebaseSecret, {
				expiresIn: viewTokenExpiry
			});
		});
	}
}
