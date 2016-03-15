var oneMinute = 1 * 60 * 1000;

module.exports = function isPublished(item) {
  if (item.publish_date == null) {
    return false;
  } else {
    var publicationDate = Date.parse(item.publish_date);
    
    return (publicationDate <= (Date.now() + oneMinute));
  }
}