'use strict';

var WebSocket = require("ws");

var wsEndpoint = "ws://localhost:6557/";

var ws = new WebSocket(wsEndpoint);
 
ws.on('open', function open() {
  ws.send(JSON.stringify({
    site: "demo.toitoi.co",
    token: process.argv[2],
    messageType: "build",
    commandId: "foobar"
  }));
});
 
ws.on('message', function(data, flags) {
  var message = JSON.parse(data);
  console.log(message);
});