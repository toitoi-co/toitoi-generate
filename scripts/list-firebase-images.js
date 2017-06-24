'use strict';

const Promise = require("bluebird");
const fs = require("fs");

const createEnvironment = require("../libs/environment/create");
const getFirebaseValueAsync = require("../libs/util/get-firebase-value-async");
const escapeKey = require("../libs/util/escape-key");

const oldConfig = JSON.parse(fs.readFileSync("../.firebase.conf"));
const config = require("../config.json");

var debugMode = (process.env.NODE_DEBUG != null && /(^|,)generate($|,)/.test(process.env.NODE_DEBUG))

return Promise.try(() => {
	return createFirebaseClient({
		database: config.firebaseName,
		login: {
			email: config.firebaseLogin.email,
			password: config.firebaseLogin.password
		}
	});
}).then((client) => {
	return Promise.try(() => {
		console.log("Fetching data...")
		return getFirebaseValueAsync(firebaseRoot.child(`buckets/${escapeKey(oldConfig.siteName)}/${oldConfig.secretKey}/dev`));
	}).then((data) => {
		Object.keys(data.data).forEach((type) => {
			Object.keys(data.data[type]).forEach((itemKey) => {
				let value = data.data[type][itemKey];

				Object.keys(value).forEach((key) => {
					let property = value[key];

					if (property.resize_url != null) {
						console.log(property.url);
					}
				});
			});
		});

		process.exit(0);
	});
});
