'use strict';

const firebaseJSON = require("firebase-json");
const fs = require("fs");

let aclFile = fs.readFileSync("../acl.json5", "utf8");

let rules = firebaseJSON.parse(aclFile);

function scanRule(rule, path) {
	if (rule['.read'] != null && rule['.read'] !== "false" && rule['.read'] !== false) {
		console.log(`${path.join("/")} (${rule['.read']})`);
	} else {
		Object.keys(rule).forEach((key) => {
			if (key[0] !== ".") {
				scanRule(rule[key], path.concat([key]));
			}
		});
	}
}

scanRule(rules.rules, []);
