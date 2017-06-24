'use strict';

var Promise = require("bluebird");
var bhttp = require("bhttp");
var urlJoin = require("url-join");

function apiPath(path) {
  return urlJoin("http://localhost:6557/", path);
}

Promise.try(function() {
  return bhttp.get(apiPath("/images/demo.toitoi.co"), {
    headers: {
      "x-token": process.argv[2]
    }
  });
}).then(function(response) {
  console.log("RESPONSE:", response.body);
});
