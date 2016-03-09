var uslug = require('uslug');
var dotty = require('dotty');
var extend = require('extend');

module.exports = function(templateState, api) {
	/**
	* Returns all content types for a given site
	* @returns  {Array}  An array of type object (slug and name of type)
	*/
	function getTypes(returnOneOffs) {
		var types = [];
		
		return Object.keys(templateState.typeInfo).map(function(key) {
			var type = templateState.typeInfo[key];
			var slug;
			
			if (returnOneOffs || !type.oneOff) {
				if (dotty.exists(type, "customUrls.listUrl") && type.customUrls.listUrl !== '#') { // FIXME: What does # signify?
					slug = type.customUrls.listUrl;
				} else {
					slug = key;
				}
			}
			
			return {
				slug: slug,
				name: type.name,
				id: key
			};
		})
	};
	
	/**
	* Returns a standard url for a given object, only works for standard scaffolding url structure
	* @param  {Object}   object     Object to generate url for
	* @returns {String}   Url for the object passed in
	*/
	function generateUrl(object) {
		if (typeof object === 'string') {
			var types = getTypes(true);

			object = _.find(types, function(type) {
				return type.name.toLowerCase() == object.toLowerCase() || type.id.toLowerCase() == object.toLowerCase()
			});
		}

		if(object == null) {
			// FIXME: Shouldn't this be an error?
			return '';
		}

		if(object.slug != null) {
			return '/' + object.slug + '/';
		} else {
			var slug = (object.name != null) ? uslug(object.name).toLowerCase() : "";
			
			if (object._type != null) {
				return '/' + object._type + '/' + slug + '/';
			} else {
				return '/' + slug + '/';
			}
		}
	}
	
	extend(api, {
		url: generateUrl,
		getTypes: getTypes
	});
}