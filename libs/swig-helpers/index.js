var Promise = require("bluebird");
var extend = require("extend");

module.exports = function(templateState, api) {
	// FIXME: Are the following two methods necessary, or are they just used internally?
	extend(api, {
		init: function() {
			templateState.paginate = false;
			templateState.curPage = 1;
			templateState.pageUrl = "page-";
			templateState.maxPage = -1; // FIXME: Magic value?
			templateState.paginationBaseUrl = null; // FIXME: Should this be null?
		},
		getFunctions: function() {
			return api;
		},
		cmsVersion: "v2"
	});
	
	var modules = [
		"generate-url",
		"get",
		"pagination",
		"navigation",
		"random",
		"merge",
		"set-params"
	]
	
	modules.forEach(function(moduleName) {
		require("./" + moduleName)(templateState, api);
	});
	
	var cmsObject = {};
	
	api.getTypes(true).forEach(function(type) {
		Object.defineProperty(cmsObject, type, {
			get: function() { return api.get(type); },
			enumerable: true,
			configurable: true
		})
	})
	
	api.cms = cmsObject;
	
	Object.defineProperty(api, "cms_types", {
		get: function() { return api.getTypes(); },
		enumerable: true,
		configurable: true
	});
	
	return api;
}