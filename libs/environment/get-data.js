var Promise = require("bluebird");
var extend = require("extend");
var defaultValue = require("default-value");

module.exports = function(options) {
  var env = options.environment;

  options = defaultValue(options, {});
  options.dataKey = defaultValue(options.dataKey, "data");

  var getBucketData = require("../firebase/bucket-data")(options.firebaseRoot);
  var getDnsData = require("../firebase/dns-data")(options.firebaseRoot);

  var cachedData;

  function extractData(bucketData) {
    var typeInfo, settings, content;

    if (bucketData == null) {
      typeInfo = {};
      settings = {};
      content = {};
    } else {
      if (bucketData.contentType != null) {
        typeInfo = bucketData.contentType;
      } else {
        typeInfo = {};
      }

      if (bucketData[options.dataKey] != null) {
        content = bucketData[options.dataKey];
      } else {
        content = {};
      }

      if (bucketData.settings != null) {
        settings = bucketData.settings;
      } else {
        settings = {};
      }
    }

    return {
      data: content,
      typeInfo: typeInfo,
      settings: settings
    }
  }

  return function getData() { // FIXME: Memoize?
    return Promise.try(function() {
      env.logger.ok('Retrieving site data...');
      if (cachedData != null) {
        return cachedData;
      } else {
        return Promise.all([
          getBucketData(options.siteName, options.secretKey),
          getDnsData(options.siteName)
        ]).spread(function(bucketData, dnsData) {
          // REFACT: `dnsData` is actually `domainName`, and may not even be used in our case...
          if (dnsData == null) {
            dnsData = options.siteName + ".webhook.org";
          }

          cachedData = extend({
            siteDns: dnsData
          }, extractData(bucketData));

          return cachedData;
        });
      }
    })
  }
}