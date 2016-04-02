var path = require("path");

module.exports = function(originalPath, suffix) {
	var parsedPath = path.parse(originalPath);

	parsedPath.name += suffix;
	parsedPath.base = parsedPath.name + parsedPath.ext; // FIXME: This is supposed to be done by the `path` module, according to the docs... but it doesn't.

	return path.format(parsedPath);
}
