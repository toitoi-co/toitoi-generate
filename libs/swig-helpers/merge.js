var extend = require("extend");

module.exports = function(templateState, api) {
	extend(api, {
		merge: function() {
			var arrays = [].slice.call(arguments, 0);

			var combinedArray = [];

			arrays.forEach(function(array) {
				if(array !== "" && array !== null) { // FIXME: Silent failure?
					combinedArray = combinedArray.concat(array);
				}
			})

			return combinedArray;
		}
	});
}