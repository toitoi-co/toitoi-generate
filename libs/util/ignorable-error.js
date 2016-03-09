var extend = require("extend");

module.exports = function ignorableError(message, properties) {
	var err = new Error(message);
	
	err.ignorable = true;
	extend(err, properties);
	
	return err;
}