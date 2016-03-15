'use strict';

var WebSocket = require("ws");

var wsEndpoint = "ws://localhost:6557/";

var ws = new WebSocket(wsEndpoint);
 
ws.on('open', function open() {
  ws.send(JSON.stringify({
    site: "fakesite.toitoi.co",
    messageType: "preset",
    signedRequest: process.argv[2]
  }));
});
 
ws.on('message', function(data, flags) {
  var message = JSON.parse(data);
  console.log(message);
});