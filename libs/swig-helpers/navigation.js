var _ = require("lodash");
var extend = require("extend");

module.exports = function(templateState, api) {
	extend(api, {
		sortItems: function(input, property, reverse) {
			if (_.size(input) === 0) {
				return input; // FIXME: Should this be an error?
			}
			
			var first = input[0];
			var numericSortProperty = "_sort_" + property;
			
			var sortProperty;
			
			if (first[numericSortProperty] != null) {
				sortProperty = numericSortProperty;
			} else {
				sortProperty = property;
			}
			
			/* We're still using Lodash sort here, as standard Array#sort is:
			 *  1. In-place.
			 *  2. Not guaranteed to be stable.
			 */
			var sortedItems = _.sortBy(input, property);
			
			if (reverse) {
				return sortedItems.reverse();
			} else {
				return sortedItems;
			}
		},
		prevItem: function(item, sortName, reverseSort) {
			var type = item._type;
			var items = api.get(type);
			
			if (sortName != null) {
				items = api.sortItems(items, sortName, reverseSort);
			}
			
			var previousItem, result;
			
			/* Iterate through the list until our previousItem was the one
			 * we started from - the current item will be the next one.
			 */
			items.some(function(candidateItem) {
				if (previousItem != null && previousItem._id == item._id) {
					result = candidateItem;
					return true;
				} else {
					previousItem = candidateItem;
				}
			});
			
			return result; // FIXME: Error case?
		},
		nextItem: function(item, sortName, reverseSort) {
			var type = item._type;
			var items = api.get(type);
			
			if (sortName != null) {
				items = api.sortItems(items, sortName, reverseSort);
			}
			
			var previousItem, result;
			
			/* Once we encounter the item we started from, the previous
			 * item will have been the one we're looking for.
			 */
			items.some(function(candidateItem) {
				if (candidateItem._id == item._id) {
					result = previousItem;
					return true;
				} else {
					previousItem = candidateItem;
				}
			})
			
			return result; // FIXME: Error case?
		}
	});
}