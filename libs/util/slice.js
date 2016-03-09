'use strict';

var sliceObject = require("./slice-object");

module.exports = function(data, limit, offset) {
	if (Array.isArray(data)) {
		return data.slice(offset, limit + offset);
	} else {
		return sliceObject(data, limit, offset);
	}
};