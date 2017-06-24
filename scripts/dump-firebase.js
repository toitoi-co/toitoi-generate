'use strict';

const Promise = require("bluebird");
const fs = require("fs");
const firebase = require("firebase");
const dotty = require("dotty");

const createEnvironment = require("../libs/environment/create");
const getFirebaseValueAsync = require("../libs/util/get-firebase-value-async");
const escapeKey = require("../libs/util/escape-key");
const createFirebaseClient = require("../libs/firebase/create-client");
const pathGenerator = require("../libs/firebase/path-generator");

const oldConfig = JSON.parse(fs.readFileSync("../.firebase.conf"));
const config = require("../config.json");

const util = require("util");

var debugMode = (process.env.NODE_DEBUG != null && /(^|,)generate($|,)/.test(process.env.NODE_DEBUG))

let targetPaths = [
	"buckets/$site/$bucket",
	"management/sites/$site",
]

let createPath = pathGenerator(oldConfig);

return Promise.try(() => {
	return createFirebaseClient({
		database: config.firebaseName,
		login: {
			email: config.firebaseLogin.email,
			password: config.firebaseLogin.password
		}
	});
}).then((client) => {
	//console.log("Fetching data...")
	return Promise.map(targetPaths, (targetPath) => {
		let generatedPath = createPath(targetPath);

		return Promise.try(() => {
			return getFirebaseValueAsync(client.child(generatedPath))
		}).then((result) => {
			return {
				path: generatedPath,
				data: result
			}
		});
	}).then((data) => {
		let dump = {};

		data.forEach((item) => {
			dotty.put(dump, item.path.split("/"), item.data);
		});

		console.log(JSON.stringify(dump, undefined, 4));
	});
});
