var dotty = require("dotty");
var formatCustomUrl = require('./format-custom-url');

module.exports = function(slugGenerator) {
  return function getItemSlug(item, typeInfo) {
    if (item.slug != null) {
      return item.slug;
    } else {
      var slug;

      if (dotty.exists(typeInfo, "customUrls.individualUrl")) {
        slug = formatCustomUrl(typeInfo.customUrls.individualUrl, item) + "/" + slugGenerator(item);
      } else if (dotty.exists(typeInfo, "customUrls.listUrl")) {
        slug = formatCustomUrl(typeInfo.customUrls.listUrl, item) + "/" + slugGenerator(item);
      } else {
        if (item._type != null) {
          slug = item._type + "/" + slugGenerator(item);
        } else {
          // FIXME: This is probably an error/bug?
          slug = slugGenerator(item);
        }
      }

      if (item.slug == null) {
        // FIXME: Mutation, this stinks... but is necessary for now.
        item.slug = slug;
      }

      return slug;
    }
  }
}
