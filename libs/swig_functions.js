'use strict';

/**
 * Defines a set of functions usable in all swig templates, are merged into context on render
 * @param  {Object}   swig        Swig engine
 */
module.exports.swigFunctions = function(swig) {
	var templateState = {
		typeInfo: {},
		data: {},
		settings: {},
		context: {} // FIXME: Is this actually used anywhere?
	};

	var api = {
		setData: function(data) {
			templateState.cachedData = {}; // FIXME: un-memoize instead
			templateState.data = {};
		},
		setTypeInfo: function(typeInfo) {
			templateState.typeInfo = typeInfo;
		},
		setSettings: function(settings) {
			templateState.settings = settings;
		},
		getSetting: function(key) {
			if (templateState.settings.general == null) {
				return null; // FIXME: Silent failure - is this intended?
			}
			
			return templateState.settings.general[key];
		}
	};
	
	require("./swig-helpers")(templateState, api);
	
	return api;
};