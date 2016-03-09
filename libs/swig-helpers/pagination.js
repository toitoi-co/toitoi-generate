var slice = require("../util/slice");
var _ = require("lodash");
var extend = require("extend");

module.exports = function(templateState, api) {
	templateState.paginate = false;
	templateState.curPage = 1;
	templateState.maxPage = -1;
	templateState.pageUrl = 'page-';
	templateState.paginationBaseUrl = null;
	templateState.CURRENT_URL = '/';
	
	extend(api, {
		paginate: function(data, perPage, pageName) {
			if(templateState.curPage === 1 && templateState.paginate === true) {
				// FIXME: Error type!
				throw new Error('Can only paginate one set of data in a template.');
			}

			var items = slice(data, perPage, perPage * (templateState.curPage - 1));
			templateState.paginate = true;

			if(templateState.paginationBaseUrl == null) {
				templateState.paginationBaseUrl = templateState.CURRENT_URL;
			}

			if (templateState.pageUrl == null) {
				templateState.pageUrl = pageName;
			}

			templateState.maxPage = Math.ceil(_(data).size() / perPage);

			return items;
		},
		getCurPage: function() {
			return templateState.curPage;
		},
		getMaxPage: function() {
			return templateState.maxPage;
		},
		getPageUrl: function(pageNum) {
			if (pageNum == 1) {
				return templateState.paginationBaseUrl;
			}

			return templateState.paginationBaseUrl + templateState.pageUrl + pageNum + '/';
		},
		getCurrentUrl: function() {
			return templateState.CURRENT_URL;
		},
		shouldPaginate: function() {
			return (templateState.curPage <= templateState.maxPage);
		},
		increasePage: function() {
			templateState.curPage += 1;
		}
	});
}