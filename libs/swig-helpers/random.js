var extend = require("extend");

module.exports = function(templateState, api) {
	extend(api, {
		random: function(array) {
			if(array == null || !Array.isArray(array) || array.length === 0) {
				return null; // FIXME: Silent failure - intended?
			}

			var index = Math.floor(Math.random() * array.length);
			return array[index];
		};
	})
}