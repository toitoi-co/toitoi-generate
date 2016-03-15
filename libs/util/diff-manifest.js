'use strict';

const path = require("path");
const events = require("events");
const walk = require("walk");
const fs = require("fs-extra");

module.exports = function(sourceRoot) {
	return function diffManifest(manifest) {
		let emitter = new events.EventEmitter();
		let walker = walk.walk(sourceRoot);
		let walkerFinished = false;
		let activeOperations = 0;

		let manifestMap = {};

		manifest.forEach((item) => {
			manifestMap[item.path] = item;
		});

		walker.on("file", (root, stat, next) => {
			let itemPath = path.join(root, stat.name).replace(sourceRoot + "/", "");

			if (manifestMap[itemPath] == null) {
				activeOperations++;
				fs.readFile(path.join(root, stat.name), (err, data) => {
					activeOperations--;

					// FIXME: Error handling
					if (err == null) {
						emitter.emit("create", {
							data: data.toString("base64"),
							path: itemPath
						});
					}
					
					checkDone();
				});
			} else {
				let remoteItem = manifestMap[itemPath];
				delete manifestMap[itemPath];

				if (stat.mtime.getTime() !== remoteItem.mtime || stat.size !== remoteItem.size) {
					activeOperations++;
					fs.readFile(path.join(root, stat.name), (err, data) => {
						activeOperations--;
						
						// FIXME: Error handling
						if (err == null) {
							emitter.emit("update", {
								data: data.toString("base64"),
								path: itemPath
							});
						}
						
						checkDone();
					});
				}
			}

			next();
		});

		walker.on("end", () => {
			Object.keys(manifestMap).forEach((path) => {
				emitter.emit("delete", {
					path: path
				});
			});
			
			walkerFinished = true;

			checkDone();
		});

		function checkDone() {
			if (walkerFinished && activeOperations === 0) {
				emitter.emit("end");
			}
		}
		
		return emitter;
	}
}
