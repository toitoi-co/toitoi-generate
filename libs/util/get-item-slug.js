var dotty = require("dotty");
var formatCustomUrl = require('./format-custom-url');

module.exports = function(slugGenerator) {
  return function getItemSlug(item, typeInfo) {
    var itemSlug, completeSlug;
    
    if (item.slug != null) {
      itemSlug = item.slug;
    } else {
      itemSlug = slugGenerator(item);
    }
    
    if (dotty.exists(typeInfo, "customUrls.individualUrl")) {
      completeSlug = formatCustomUrl(typeInfo.customUrls.individualUrl, item) + "/" + itemSlug;
    } else {
      completeSlug = itemSlug;
    }
    
    if (item.slug == null) {
      // FIXME: Mutation, this stinks... but is necessary for now.
      item.slug = completeSlug;
    }
    
    return completeSlug;
  }
}