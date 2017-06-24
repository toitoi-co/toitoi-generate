'use strict';

const Promise = require("bluebird");
const fs = require("fs");

const createEnvironment = require("../libs/environment/create");
const getFirebaseValueAsync = require("../libs/util/get-firebase-value-async");
const escapeKey = require("../libs/util/escape-key");
const createFirebaseClient = require("../libs/firebase/create-client");

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
		return createEnvironment({
			strictMode: true,
			siteName: oldConfig.siteName,
			secretKey: oldConfig.secretKey,
			noSearch: false,
			firebaseName: config.firebaseName,
			firebaseRoot: client,
			embedlyKey: config.embedlyKey,
			webhookServer: config.webhookServer,
			debugMode: debugMode,
			config: Object.assign({}, config, oldConfig)
		});
	}).then((environment) => {
		return environment.queueBuild({
			type: "all",
			preview: false,
			deploymentStep: function deploy(task) {
				console.log("Faking deployment...");
			}
		});
	}).then((buildResult) => {
		console.log("== BUILD COMPLETED ==");
		console.log(buildResult);
	});
});
