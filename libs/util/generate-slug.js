var uslug = require("uslug");

module.exports = function() {
	// Wrapped in a factory function, to allow for different sets of knownSlugs.
	
	var knownSlugs = {}; // To prevent collisions in generateSlug
	
	return function generateSlug(item) {
		// FIXME: This doesn't look deterministic, and seems like it might break on name collisions
		//        when the order of colliding items is different (or it is run on an incomplete set).
		
		if (knownSlugs[item._type] == null) {
			knownSlugs[item._type] = {};
		}
		
		if(item.slug) {
			// FIXME: This code path is probably never reached, due to the logic in getSlug (getItem, previously)?
			knownSlugs[item._type][item.slug] = true;
			return item.slug;
		}
		
		var attemptedSlug = uslug(item.name).toLowerCase();
		
		var suffix = 2;
		while(knownSlugs[item._type][attemptedSlug] != null) {
			// This code will only run if a slug collision happens, and until it has been resolved.
			attemptedSlug = uslug(item.name).toLowerCase() + "_" + suffix;
		}
		
		knownSlugs[item._type][attemptedSlug] = true;
		
		return attemptedSlug;
	}
}