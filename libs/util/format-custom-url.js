var moment = require("moment");

// #Y - Year Full
// #y - Year last two digits
// #m - Month number, leading zero
// #n - Month number, no leading zero
// #F - Month name full (january, october, etc)
// #M - Month short name (jan, oct, etc)
// #d - Day leading zero
// #j - Day, no leading zero
// #T - The typename (e.g. articles)

module.exports = function(format, value) {
	// FIXME: Is `value` meant to accept both a CMS item and a date string directly? This
	//        would break on CMS items that don't have a publication date yet...
	// FIXME: Localization?
	var publishDate;
	
	if (value.publish_date != null) {
		publishDate = moment(value.publish_date);
	} else {
		publishDate = moment(value);
	}
	
	return format.replace(/#(\w)/g, function(match, formatIdentifier, offset, string){
		if(formatIdentifier === 'Y') {
			return publishDate.format('YYYY').toLowerCase();
		} else if (formatIdentifier === 'y') {
			return publishDate.format('YY').toLowerCase();
		} else if (formatIdentifier === 'm') {
			return publishDate.format('MM').toLowerCase();
		} else if (formatIdentifier === 'n') {
			return publishDate.format('M').toLowerCase();
		} else if (formatIdentifier === 'F') {
			return publishDate.format('MMMM').toLowerCase();
		} else if (formatIdentifier === 'M') {
			return publishDate.format('MMM').toLowerCase();
		} else if (formatIdentifier === 'd') {
			return publishDate.format('DD').toLowerCase();
		} else if (formatIdentifier === 'j') {
			return publishDate.format('D').toLowerCase();
		} else if (formatIdentifier === 'T') {
			return object._type.toLowerCase();
		} else {
			return match;
		}
	});
}