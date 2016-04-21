var WebSocketServer = require("ws").Server;
var express = require('express');
var app = express();
var port = process.env.PORT || 5000;
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
    if ('OPTIONS' == req.method) {
      res.send(200);
    }
    else {
      next();
    }
};
var client_sockets = [];
var client_object = {};
var client_objects = [];

app.use(allowCrossDomain);
app.use(express.static(__dirname + '/'));

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

server.listen(port);
console.log('listening on ' + port);

io.on('connection', function (socket) {
  console.info('client connected | ' + socket.id);
});
