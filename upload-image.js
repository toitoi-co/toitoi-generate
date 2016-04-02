'use strict';

var Promise = require("bluebird");
var bhttp = require("bhttp");
var urlJoin = require("url-join");
var fs = require("fs");

function apiPath(path) {
  return urlJoin("http://localhost:6557/", path);
}

Promise.try(function() {
  return bhttp.put(apiPath("/images/demo.toitoi.co/opera2.jpg"), fs.createReadStream("./2015-07-17-1437158370-7415732-nycopera1.jpg"), {
    headers: {
      "x-token": process.argv[2]
    }
  });
}).then(function(response) {
  console.log("RESPONSE:", response.body);
});
