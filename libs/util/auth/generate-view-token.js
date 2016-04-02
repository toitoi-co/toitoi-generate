var Promise = require("bluebird");
var jwt = require("jsonwebtoken-promisified");

module.exports = function(firebaseSecret) {
	return function(token, site) {
		return Promise.try(function() {
			return jwt.signAsync({
				sitename: site
			}, firebaseSecret);
		});
	}
}
