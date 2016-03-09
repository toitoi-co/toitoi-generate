var extend = require("extend");

// FIXME: Is this used outside of setting `CURRENT_URL` in generator.js?
module.exports = function(templateState, api) {
	extend(api, {
		setParams: function(parameters) {
			extend(templateState, parameters);
		}
	});
}