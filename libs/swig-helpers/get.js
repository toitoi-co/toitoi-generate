var dotty = require("dotty");
var urlJoin = require("url-join");
var memoize = require("memoizee");

var formatCustomUrl = require("../util/format-custom-url");
var parseRelationshipString = require("../util/parse-relationship-string");
var getRelationshipFields = require("../util/get-relationship-fields");
var ignorableError = require("../util/ignorable-error");
var generateSlug = require("../util/generate-slug")();

module.exports = function(templateState, api) {
	function parseRelationshipStrings(strings) {
		// FIXME: This will only parse a single relationship string, even if an array is provided. Is this intended?
		if (Array.isArray(strings)) {
			if (strings.length > 0) {
				return parseRelationshipString(strings[0]);
			} else {
				throw ignorableError("No relationship strings specified.")
			}
		} else {
			return parseRelationshipString(strings);
		}
	}
	
	function parseIdentifier(type, key) {
		if (!type) { // FIXME: Check for null-ish instead?
			throw ignorableError("No identifier specified.")
		}
		
		if (key == null) {
			return parseRelationshipStrings(type);
		} else {
			return {
				type: type,
				key: key
			};
		}
	}
	
	function configureGetter(object, relationship) {
		var relationshipString = object[relationship.name];
		
		if (relationship.isSingle) {
			Object.defineProperty(object, relationship.name, {
				enumerable: true,
				configurable: true,
				get: function() {
					if (relationshipString != null) {
						return getItem(relationshipString);
					}
				}
			});
			
			// This allows access to unpublished items as well.
			Object.defineProperty(object, "_" + relationship.name, {
				enumerable: true,
				configurable: true,
				get: function() {
					if (relationshipString != null) {
						return getItem(relationshipString, null, true);
					}
				}
			});
		} else {
			Object.defineProperty(object, relationship.name, {
				enumerable: true,
				configurable: true,
				get: function() {
					if (relationshipString != null) {
						return getItems(relationshipString);
					}
				}
			});
			
			// This allows access to unpublished items as well.
			Object.defineProperty(object, "_" + relationship.name, {
				enumerable: true,
				configurable: true,
				get: function() {
					if (relationshipString != null) {
						return getItems(relationshipString, true);
					}
				}
			});
		}
	}
	
	function configureGetterOnce(object, relationship) {
		// To prevent setting a getter on the same object twice, we first check whether one was already set.
		// FIXME: Why is this necessary? Is this lacking determinism somehow?
		
		var descriptor = Object.getOwnPropertyDescriptor(object, relationship.name);
		
		if (!dotty.has(descriptor, "get")) {
			configureGetter(object, relationship);
		}
	}
	
	function configureRelationships(item, typeInfo) {
		// CAUTION: This method mutates the item.
		/* This will read the relationship configuration for the content type, and then use
		 * that configuration to set up getters on a data object - one getter for each
		 * relationship, on the correspondingly named property.
		 * 
		 * This way, related objects can be fetched lazily. FIXME: Why is that needed?
		 */
		
		var relationshipFields = getRelationshipFields(typeInfo);
		
		relationshipFields.forEach(function(relationship) {
			if(relationship.ownerField != null) {
				// This is a grid
				var gridArray = object[relationship.ownerField];

				if(!gridArray) {
					// FIXME: Will this break stuff? How do these grids even work, internally?
					throw ignorableError("No grid array[?] found.");
				}

				gridArray.forEach(function(gridItem) {
					configureGetterOnce(gridItem, relationship);
				});
			} else {
				configureGetterOnce(item, relationship);
			}
		});
	}
	
	function getSlug(item, typeInfo) {
		if (item.slug != null) {
			return item.slug;
		} else {
			var pathSegments = [];
			
			if (dotty.has(typeInfo, "customUrls.listUrl")) {
				if (typeInfo.customUrls.listUrl !== '#') { // FIXME: What is this for? It does not appear to be documented...
					pathSegments.push(typeInfo.customUrls.listUrl);
				} else {
					// FIXME: No prefix at all. Is this intended behaviour? It would generate an item URL in the root.
				}
			} else {
				pathSegments.push(item._type); // FIXME: Is there a better way to do this?
			}
			
			if (dotty.has(typeInfo, "customUrls.individualUrl")) {
				// This will generally be something like a date prefix, and is applied for each item individually.
				pathSegments.push(formatCustomUrl(typeInfo.customUrls.individualUrl, item))
			}
			
			pathSegments.push(generateSlug(item));
			
			return urlJoin.apply(null, pathSegments);
		}
	}
	
	function validatePublished(item, typeInfo) {
		if (!typeInfo.oneOff) {
			if (item.publish_date == null) {
				throw ignorableError("Not allowed to provide unpublished item.")
			}

			var publicationDate = Date.parse(item.publish_date);

			if (publicationDate > (Date.now() + (1 * 60 * 1000))) { // ????
				throw ignorableError("Item not published yet.");
			}
		}
	}
	
	function processItem(item, typeInfo, ignorePublicationStatus) {
		// CAUTION: This method mutates the item.
		// All the post-processing for 'queried' items happens here.
		
		item.slug = getSlug(item, typeInfo);

		if (!ignorePublicationStatus) {
			validatePublished();
		}

		configureRelationships(item, typeInfo);
		
		return item;
	}
	
	function getItem(type, key, ignorePublicationStatus) {
		try {
			var query = parseIdentifier(type, key);
			var typeInfo = templateState.typeInfo[query.type];
			
			if (typeInfo == null) {
				// FIXME: Should this be ignorable?
				throw ignorableError("No such content type exists.");
			}
			
			var item;
			
			if (typeInfo.oneOff) {
				item = templateState.data[query.type];
			} else {
				item = templateState.data[query.type][query.key];
			}
			
			if (item == null) {
				// FIXME: Potential problem case: Content type exists, corresponding 'data' entry does not, type is a category rather than a one-off. Will fail trying to look up the key on `undefined`.
				throw ignorableError("No such item exists.")
			}
			
			// FIXME: Is this only used in getSlug, or also within the templates? Mutation is not a very nice way to do this...
			item._type = query.type;
			item._id = query.key;
			
			return processItem(item, typeInfo, ignorePublicationStatus);
		} catch (err) {
			if (err.ignorable) {
				// Return silently, because the templater can presumably not deal with errors being thrown.
				return {};
			} else {
				// Not an expected type of error, rethrow.
				throw err;
			}
		}
	}
	
	function getItems(queries, ignorePublicationStatus) {
		try {
			if (queries == null) {
				throw ignorableError("No queries specified.");
			}

			return queries.map(function(query) {
				return getItem(query, null, ignorePublicationStatus);
			}).filter(function(item) {
				return !(_.isEmpty(item)); // This is to filter out errors, presumably?
			});
		} catch (err) {
			if (err.ignorable) {
				// Return silently, because the templater can presumably not deal with errors being thrown.
				return {};
			} else {
				// Not an expected type of error, rethrow.
				throw err;
			}
		}
	}
	
	function getCombined() {
		/* This should really be called getAll, or something. It retrieves all items for one
		 * or more content types.
		 */
		
		var types, ignorePublicationStatus;
		
		if (typeof arguments[arguments.length - 1] === "boolean") {
			types = [].slice.call(arguments, 0, 1); // deopt!
			ignorePublicationStatus = arguments[arguments.length - 1];
		} else {
			types = [].slice.call(arguments); // deopt!
			ignorePublicationStatus = false;
		}
		
		if (types.length === 0) {
			// FIXME: Is this desired behaviour...? This looks like it should be an error.
			return [];
		}
		
		var combinedItems = types.map(function(type) {
			var typeInfo = templateState.typeInfo[type];
			var items = templateState.data[type];
			
			if (typeInfo.oneOff) {
				// FIXME: We probably shouldn't set _type/_id here... as they don't make sense for a one-off item.
				//        Problem is, the original code skips the slug generation for one-off items, but *only* in
				//        getCombined, and not in getItem/getItems. But in getItem, _type and _id don't make sense
				//        either, but handling one-off pages seems broken there in general (see also the FIXMEs in
				//        the parseRelationShip function).
				
				// `items` is actually just a single item.
				return processItem(items);
			} else {
				return Object.keys(items).filter(function(key) {
					// Ignore 'private' or metadata keys?
					return (key.indexOf("_") !== 0);
				}).map(function(key) {
					var item = items[key];

					item._type = type;
					item._id = key;

					return processItem(item, typeInfo, ignorePublicationStatus);
				});
			}
		}).reduce(function(total, items) {
			// Flatten the list.
			return total.concat(items);
		}, []);
	}
	
	extend(api, {
		get: memoize(getCombined, {primitive: true}),
		getItem: function(type, key, ignorePublicationStatus) {
			// FIXME: Why does this exist?
			if(typeof type === 'string' && key != null) {
				return getItem(type, key, ignorePublicationStatus);
			} else {
				return type;
			}
		},
		_realGetItem: function(type, key, ignorePublicationStatus) {
			return getItem(type, key, ignorePublicationStatus);
		},
		getItems: function(holder) {
			return holder;
		}
	});
}