'use strict';

const Promise = require("bluebird");
const Firebase = require("firebase");
const FirebaseTokenGenerator = require("firebase-token-generator");
const bhttp = require("bhttp");

const util = require("util");

module.exports = function createFirebaseClient(options) {
	return Promise.try(() => {
		let client = new Firebase(`https://${options.database}.firebaseio.com/`);

		return Promise.try(() => {
			if (options.key != null) {
				let firebaseToken = (new FirebaseTokenGenerator(options.key)).createToken({
					uid: "-generate"
				}, {
					expires: Date.now() + 31536000, // FIXME: Add reauthentication logic
					admin: true
				});

				return client.authWithCustomToken(firebaseToken);
			} else if (options.login != null) {
				return Promise.try(() => {
					return bhttp.get(`https://auth.firebase.com/auth/firebase?email=${encodeURIComponent(options.login.email)}&password=${encodeURIComponent(options.login.password)}&firebase=${options.database}`); // FIXME: Massive hack!
				}).then((response) => {
					if (response.body.error != null && response.body.error.code != null && response.body.error.code === "AUTHENTICATION_DISABLED") {
						return client.authWithPassword({
							email: options.login.email,
							password: options.login.password
						});
					} else {
						return client.authWithCustomToken(response.body.token);
					}
				})
				/* FIXME: The below doesn't work. Why? Not a clue! */
				// return client.authWithPassword({
				// 	email: options.login.email,
				// 	password: options.login.password
				// });
			} else {
				throw new Error("No login details specified");
			}
		}).then((details) => {
			return client;
		})
	});
};
