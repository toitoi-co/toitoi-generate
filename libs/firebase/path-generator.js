'use strict';

module.exports = function pathGenerator(config) {
	return function createPath(path) {
		return path.replace(/\$site/g, config.siteName).replace(/\$bucket/g, config.secretKey);
	}
};
