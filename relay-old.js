var request = require('request');
var WebSocketServer = require("ws").Server;
var express = require('express');
var url = require('url');
var app = express();
var port = 5000;
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
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

var client_object = {};
var client_objects = [];
var device_object = {};
var device_objects = [];

app.use(allowCrossDomain);
app.use(express.static(__dirname + '/'));
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});
server.listen(port);
console.log('clients on port ' + port);

// --------------  reply to token request  ----------------- //
app.post('/tokens', function(req, res) {
  console.log('hit post request');
  var mac = req.body.mac;
  var device_name = req.body.device_name;
  var _token = "";
  
  for (var i=0; i < client_objects.length; i++) {
    _mac = client_objects[i].mac;
    if (_mac === mac) {
      _token = client_objects[i].token;
    }
  }

  res.send("{\"token\":\""+_token+"\"}");
});

// --------------  websocket server for devices  ----------------- //
var ws_port = 4000;
var WebSocketServer = require('ws').Server
  , wss = new WebSocketServer({ port: ws_port });
console.log('devices on port %d', ws_port);

wss.on('connection', function connection(ws) {

  device_object = { mac:"init", token:"init", socket:ws };
  device_objects.push(device_object);

  console.info('device connected');

  try { ws.send('Hello from relay server!') }
  catch (e) { console.log("error: " + e) };
  
  ws.on('message', function incoming(message) {
    var msg = {};
    
    try { msg = JSON.parse(message) }
    catch (e) { console.log("invalid json") };

    var token = msg.token;
    var magnitude = msg.magnitude;
    var mac = msg.mac;
    
    if (msg.cmd == "tok_req") {
      console.log("getting token for " + mac);
      var post_data = { mac:mac };  
      var response = request.post(
        'http://pyfi.org/php/make_token.php',
        {form: post_data},
        function (error, response, data) {
          if (!error && response.statusCode == 200) {
            console.log('make_token.php | ' + data);
            try { data = JSON.parse(data) }
            catch (e) { console.log("invalid json") };
            try { ws.send('token' + data[0].token) }
            catch (e) { console.log("reply error | " + e) };
          }
      });
    }
        
    for (var i=0; i < device_objects.length; i++) {
      _socket = device_objects[i].socket;
      _token = device_objects[i].token;
      _mac = device_objects[i].mac;
      if ( token && _socket === ws && _token === "init") {
        device_objects[i]['token'] = token;
        device_objects[i]['mac'] = mac;
        console.log("linked token and mac with socket");
      }
    }

    if (magnitude > 1000) {
      var post_data = { token:token, mac:mac, magnitude:magnitude };  
      var response = request.post('http://pyfi.org/php/get_assoc_macs.php', {form: post_data},
      function (error, response, data) {
        try { data = JSON.parse(data) }
        catch (e) { console.log("invalid json") };
        console.log('get_assoc_macs.php | ');
        for (var i=0; i < data.length; i++) {
          token = data[i].token;
          for (var j=0; j < client_objects.length; j++) {
            _token = client_objects[j].token;
            if (_token && _token === token) {
              _socket = client_objects[j].socket;
              _mac = client_objects[j].mac;
              _socket.emit('light_theme', { theme:'presence' });  
              console.log(mac + " | set light theme to 'presence' " + magnitude);
            }
          }
        }
      });
    }

    if (magnitude > 50000) {
      var post_data = { token:token, mac:mac, magnitude:magnitude };  
      var response = request.post('http://pyfi.org/php/gmail.php', {form: post_data},
      function (error, response, data) { 
        console.log('gmail.php | ' + data);
        console.log('set lights to alert');
        //_socket.emit('light_theme', { theme:'alert' });
      });
      
      var post_data = { token:token, mac:mac, magnitude:magnitude };  
      var response = request.post('http://pyfi.org/php/get_assoc_macs.php', {form: post_data},
      function (error, response, data) {
        data = JSON.parse(data);
        console.log('get_assoc_macs.php | ');
        for (var i=0; i < data.length; i++) {
          token = data[i].token;
          for (var j=0; j < client_objects.length; j++) {
            _token = client_objects[j].token;
            if (_token && _token === token) {
              _socket = client_objects[j].socket;
              _mac = client_objects[j].mac;
              _socket.emit('light_theme', { theme:'alert' });  
              console.log(mac + " | set light theme to 'alert' " + magnitude);
            }
          }
        }    
      });      
    }
      
    for (var i=0; i < client_objects.length; i++) {          
      _token = client_objects[i].token;      
      if (_token && _token === token) {
        _socket = client_objects[i].socket;
        _mac = client_objects[i].mac;
        _socket.emit('window_sensor', { token:token, mac:mac, magnitude:magnitude });      
        console.log(mac + " | relaying data to client " + magnitude);
      }
    }
    console.log(mac + " | " + magnitude + " | " + token);
    try { ws.send('ok') }
    catch (e) { console.log("reply error: " + e) };
  });

  ws.on('close', function close() {
  
    for (var i=0; i < device_objects.length; i++) {
      _socket = device_objects[i].socket;
      _mac = device_objects[i].mac;
      if ( _socket === ws ) {
        device_objects.slice(i);
        console.log(_mac + " | disconnected");
      }
    } 
      
    console.log('disconnected');
  });
  
  ws.on('error', function() {
    console.log('device websocket error catch!');
  });
});

// -------------  socket.io server  ---------------- //
io.on('connection', function (socket) {
  console.info(socket.id + " | client connected" );
  client_objects.push(socket);
  
  socket.on('media', function (data) {
    var token = data.token;
    for (var i=0; i < client_objects.length; i++) {
      _socket = client_objects[i].socket;
      _token = client_objects[i].token;
      console.log("incoming token " + token + " | client_objects " + client_objects[i].token);
      if (_token === token) {
        _socket.emit('media', data);
        console.log(_socket.id + " | emitting to gateway " + data.cmd);
      }
    }
  });
   
  socket.on('window_sensor', function (data) {
    var token = data.token;    
    for (var i=0; i < device_objects.length; i++) {
      var _socket = device_objects[i].socket;
      var _token = device_objects[i].token;
      var _mac = device_objects[i].mac; 
      console.log("window_sensor client token | " + token);
      console.log("window_sensor device token | "  + _token);
      if (_token === token) {
        client_objects.push({ mac:_mac, token:token, socket:socket });
        console.log(_mac + " | window_sensor added to client_objects | " + _token);
      }
    }
  });

  socket.on('set_mobile', function (data) {
    console.log(data);
    try { data = JSON.parse(data) }
    catch (e) { console.log("invalid json") }
    var response = request.post('http://pyfi.org/php/set_mobile.php', {form: data},
    function (error, response, data) {
        socket.emit('token',data);
        console.log("set_mobile.php | " + data);   
    });
  });
  
  socket.on('link_mobile', function (data) {
    try { data = JSON.parse(data) }
    catch (e) { console.log("invalid json") }
    console.log(data);
    var token = data.token;
    var mac = data.mac; 
    console.log(mac + " link_mobile | " + token);
    client_objects.push( { token:token, socket:socket } );
  });

  socket.on('to_mobile', function (data) {
    /*try { data = JSON.parse(data) }
    catch (e) { console.log("invalid json") }*/
    var token = data.token;
    for (var i=0; i < client_objects.length; i++) {
      _token = client_objects[i].token;
      if (_token && _token === token) {
        _socket = client_objects[i].socket;
        _mac = client_objects[i].mac;
        console.log(token + " | sending ------------> " + data.command);
        _socket.emit('to_mobile', data);
      }
    }
  });
  
  socket.on('from_mobile', function (data) {
    try { data = JSON.parse(data) }
    catch (e) { console.log("invalid json") }    
    var token = data.token;
    for (var i=0; i < client_objects.length; i++) {
      _token = client_objects[i].token;
      if (_token && _token === token) {
        _socket = client_objects[i].socket;
        _mac = client_objects[i].mac;
        console.log(token + " | relaying gps data ");        
        _socket.emit('from_mobile', data);  
      }
    }
  });
    
  socket.on('link_camera', function (data) {
    var token = data.token;
    for (var i=0; i < client_objects.length; i++) {
      var _socket = client_objects[i].socket;
      var _token = client_objects[i].token;
      var _mac = client_objects[i].mac; 
      if (_token === token) {
        client_objects.push({ mac:_mac, token:token, socket:socket });
        i = client_objects.length; //to exist loop, should work without this?
        console.log(_mac + " | camera added to client_objects with " + _token);
      }
    }
  });
    
  socket.on('link_gateway', function (data) {
    var token = data.token;
    console.log("added to client_objects | " + token);
    client_objects.push( { token:token, socket:socket } );
  });

  socket.on('link_lights', function (data) {
    var token = data.token;
    console.log("link_lights | " + token);
    for (var i=0; i < client_objects.length; i++) {
      var _socket = client_objects[i].socket;
      var _token = client_objects[i].token;
      var _mac = client_objects[i].mac; 
      if (_token === token) {
        _socket.emit('link_lights', data);
      }
    }
  });

  socket.on('link_thermostat', function (data) {
    var token = data.token;
    console.log("link_thermostat | " + token);
    for (var i=0; i < client_objects.length; i++) {
      var _socket = client_objects[i].socket;
      var _token = client_objects[i].token;
      if (token && _token === token) {
        console.log("link_thermostat | " + token);      
        _socket.emit('link_thermostat', data);
      }
    }
  });
  
  socket.on('thermostat_state', function (data) {
    var token = data.token;
    console.log("thermostat_state | " + token);
    for (var i=0; i < client_objects.length; i++) {
      var _socket = client_objects[i].socket;
      var _token = client_objects[i].token;
      if (token && _token === token) {
        _socket.emit('thermostat_state', data);
      }
    }
  });

  socket.on('get_thermostat', function (data) {
    var token = data.token;
    console.log("get_thermostat | " + token);
    for (var i=0; i < client_objects.length; i++) {
      var _socket = client_objects[i].socket;
      var _token = client_objects[i].token;
      if (token && _token === token) {
        _socket.emit('get_thermostat', data);
      }
    }
  });

  socket.on('set_thermostat', function (data) {
    var token = data.token;
    console.log("set_thermostat | " + token);
    for (var i=0; i < client_objects.length; i++) {
      var _socket = client_objects[i].socket;
      var _token = client_objects[i].token;
      if (token && _token === token) {
        _socket.emit('set_thermostat', data);
      }
    }
  });

  socket.on('lights', function (data) {
    var token = data.token;
    console.log("lights | " + token);
    for (var i=0; i < client_objects.length; i++) {
      var _socket = client_objects[i].socket;
      var _token = client_objects[i].token;
      var _mac = client_objects[i].mac; 
      if (_token === token) {
        _socket.emit('lights', data);
      }
    }
  });  
  
  socket.on('device_info', function (data) {
    var token = data.token;
    console.log("device_info | " + token);
    for (var i=0; i < client_objects.length; i++) {
      var _socket = client_objects[i].socket;
      var _token = client_objects[i].token;
      if (token && _token === token) {
        _socket.emit('device_info', data);
        console.log("relayed device_info to clients");
      }
    }
  });
  
  socket.on('get_token', function (data) {
    var mac = data.mac;
    var local_ip = data.local_ip;
    var port = data.port;
    var device_type = data.device_type;
    var device_name = data.device_name;
    console.log(mac + " | " + device_name + " " + local_ip + " " + port);
    var post_data = { mac:mac, local_ip:local_ip, port:port, device_type:device_type, device_name:device_name };  
    var response = request.post('http://pyfi.org/php/add_device.php', {form: post_data},
    function (error, response, data) { 
      console.log("data from add_device.php | " + data);
      if (!error && response.statusCode == 200) {
        if (/^[\],:{}\s]*$/.test(data.replace(/\\["\\\/bfnrtu]/g, '@').
          replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').
          replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {
        try { data = JSON.parse(data) }
        catch (e) { console.log("invalid json") };
            console.log("json is ok");
        } else {
          console.log("json is bad");
        }
        socket.emit('token',data);
        console.log("add_device.php | " + data);   
        var index = client_objects.indexOf(socket);
        if (index != -1) {
          client_object = { socket:socket, mac:mac, token:data.token };
          client_objects[index] = client_object;
          console.log(mac + ' | device added to client_objects ' + data.token);      
        }
      }
    });
  });   
    
  socket.on('gateway', function (data) {
    var token = data.token;
    var array_size = client_objects.length;
    for (var i=0; i < array_size; i++) {
      var _socket = client_objects[i].socket;
      var _token = client_objects[i].token;
      var _mac = client_objects[i].mac; 
      if (_token === token) {
        //_socket.emit('gateway', data);
        //i = client_objects.length; //to exist loop, should work without this?
        _socket.emit('gateway', data);
        console.log(_mac + " | relayed data to gateway ");
      }
    }
  });
  
  socket.on('png_test', function (data) {
    console.log("received ping, sending reply");
    socket.emit('png_test');
  });
  
  socket.on('disconnect', function() {
    for(var i = 0, index = -1; i < client_objects.length; i++) {
      if (client_objects[i].socket === socket) {
        index = i;
        //break;
      }
    }
    if (index != -1) {
      client_objects.splice(index, 1);
      console.info(socket.id + " | client disconnected" );
    }
  });

});

