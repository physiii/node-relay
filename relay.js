const crypto = require('crypto');
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

//var client_object = {};
var client_objects = [];
//var device_object = {};
var device_objects = [];
var groups = [];

app.use(allowCrossDomain);
app.use(express.static(__dirname + '/'));
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});
server.listen(port);
console.log('clients on port ' + port);


// -------------------------------  MangoDB  --------------------------------- //
var mongodb = require('mongodb');
var ObjectId = require('mongodb').ObjectID;
var MongoClient = mongodb.MongoClient;
get_groups();
get_device_objects();
get_client_objects();

//-- get things --//
function get_groups() {
MongoClient.connect('mongodb://127.0.0.1:27017/groups', function (err, db) {
  if (err) {
    console.log('Unable to connect to the mongoDB server. Error:', err);
  } else {
    var collection = db.collection('groups');
    collection.find().toArray(function (err, result) {
      if (err) {
        console.log(err);
      } else if (result.length) {
        groups = result;
	console.log("get_groups");
      } else {
        console.log('No document(s) found with defined "find" criteria!');
      }
      db.close();
    });
  }
});
}

function get_device_objects() {
  MongoClient.connect('mongodb://127.0.0.1:27017/devices', function (err, db) {
    if (err) {
      console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {
      var collection = db.collection('devices');
      collection.find().toArray(function (err, result) {
        if (err) { 
	  console.log(err);
        } else if (result.length) {
	  device_objects = result;
  	  //console.log('get_device_objects',device_objects);	
        } else {
	  console.log('No document(s) found with defined "find" criteria!');
        }
        db.close();
      });
    }
  });
}

function get_client_objects() {
  MongoClient.connect('mongodb://127.0.0.1:27017/clients', function (err, db) {
    if (err) {
      console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {
      var collection = db.collection('clients');
      collection.find().toArray(function (err, result) {
        if (err) { 
	  console.log(err);
        } else if (result.length) {
	  client_objects = result;
  	  //console.log('get_client_objects',client_objects);	
        } else {
	  console.log('No document(s) found with defined "find" criteria!');
        }
        db.close();
      });
    }
  });
}

//-- store things --//
function store_group(group) {
  /* store group associations */
  MongoClient.connect('mongodb://127.0.0.1:27017/groups', function (err, db) {
    if (err) {
      console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {
      var collection = db.collection('groups');
      console.log('store_group_state');

      collection.update({group_id:group.group_id}, {$set:group},{upsert:true}, function(err, item){
	if (err) {
          console.log(err);
        }
	//console.log('item',item);
      });
      db.close();
      get_groups();
    }
  });
  //console.log("store_group",groups);
}

function store_device_object(device_object) {
  var temp_object = Object.assign({}, device_object);
  delete temp_object.socket;
  MongoClient.connect('mongodb://127.0.0.1:27017/devices', function (err, db) {
    if (err) {
      console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {
      var collection = db.collection('devices');
      console.log('store_device_object');

      collection.update({token:temp_object.token}, {$set:temp_object},{upsert:true}, function(err, item){
	if (err) {
          console.log(err);
        }
	//console.log('item',item);
      });
      db.close();
      //get_device_objects();
    }
  });
  //console.log("store_group",groups);
}

function store_client_object(client_object) {
  var temp_object = Object.assign({}, client_object);
  delete temp_object.socket;
  MongoClient.connect('mongodb://127.0.0.1:27017/clients', function (err, db) {
    if (err) {
      console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {
      var collection = db.collection('clients');
      console.log('store_client_object',temp_object);
      
      collection.update({token:temp_object.token}, {$set:temp_object},{upsert:true}, function(err, item){
	if (err) {
          console.log(err);
        }
	//console.log('item',item);
      });
      db.close();
      //get_client_objects();
    }
  });
}

// --------------  websocket server for devices  ----------------- //
var ws_port = 4000;
var WebSocketServer = require('ws').Server
  , wss = new WebSocketServer({ port: ws_port });
console.log('devices on port %d', ws_port);

wss.on('connection', function connection(ws) {

  try { ws.send('Hello from relay server!') }
  catch (e) { console.log("error: " + e) };
  
  ws.on('message', function incoming(message) {
    var msg = {};
    try { msg = JSON.parse(message) }
    catch (e) { console.log("invalid json") };
    var token = msg.token;
    var mac = msg.mac;
    var cmd = msg.cmd;
    var device_type = msg.device_type;
    var public_ip = ws.upgradeReq.connection.remoteAddress;
    public_ip = public_ip;
    var local_ip = msg.local_ip;

    // --------------  respond to ping requests  ----------------- //    
    if (cmd == "png_test") {
      command = "png_test";
      try { ws.send('command' + command) }
      catch (e) { console.log("reply error | " + e) };        
      //console.log(mac + " | received ping, sending reply ");
    }

    // --------------  respond to token requests  ----------------- //    
    if (cmd == "tok_req") {
      var token = crypto.createHash('sha512').update(mac).digest('hex');
      try { ws.send('token' + token) }            
      catch (e) { console.log("reply error | " + e) };

      var index = find_index(device_objects,'token',token);
      if (index < 0) {
        var device_object = { token:token, mac:mac, local_ip:local_ip, public_ip:public_ip, device_type:device_type, groups:[], socket:ws };
        store_device_object(device_object);
        device_objects.push(device_object);
        console.log('added device',device_object.mac);
      } else {
        device_objects[index].public_ip = public_ip;
        device_objects[index].local_ip = local_ip;
        device_objects[index].device_type = device_type;
        store_device_object(device_objects[index]);
        device_objects[index].socket = ws;

        var index = find_index(device_objects,'token',token);
        console.log('updated device',device_object);
      }
     
      var index = find_index(groups,'group_id',token);
      if (index < 0) {
        var group = {group_id:token, mode:'init', device_type:['alarm'], members:[]};
        groups.push(group);
        store_group(group);
      }
    }

    
    // ----------------  garage opener  ------------------- //
    if (device_type === "garage_opener") {
      for (var i=0; i < client_objects.length; i++) {
        _token = client_objects[i].token;
        //console.log("garage_opener | " + token+":"+_token);
        if (_token && _token === token) {
          _socket = client_objects[i].socket;
          _mac = client_objects[i].mac;
          _socket.emit('garage_opener', msg );  
          console.log(mac + " | sending message to client ");
        }
      }
    }

    // ---------------  media controller  ----------------- //
    if (device_type === "media_controller") {
      for (var i=0; i < client_objects.length; i++) {
        _token = client_objects[i].token;
        if (_token && _token === token) {
          _socket = client_objects[i].socket;
          _mac = client_objects[i].mac;
          _socket.emit('media_controller', msg );  
          console.log("media_controller",msg);
        }
      }
    }

    // --------------  room sensor  ----------------- //
    for (var i = 0; i < device_type.length; i++) {
      if (device_type[i] === "room_sensor") {
        if (msg.magnitude > 300) {
          var index = find_index(device_objects,'token',token);
          //loop through groups for device
          if (index < 0) return;
          for (var j = 0; j < device_objects[index].groups.length; j++) {
            //find group members
            var index2 = find_index(groups,'group_id',device_objects[index].groups[j]);
            //console.log("device_object",device_objects[index]);
            if (index2 < 0) return;
            msg.mode = groups[index2].mode;
            if (groups[index2].mode == 'armed') {
              msg.status = 'alert';
            }
            if (groups[index2].mode == 'disarmed') {
              msg.status = 'presence';
            }    
            for (var k=0; k < groups[index2].members.length; k++) {
              /*for (var k=0; k < client_objects.length; k++) {
                  if (groups[index2].members[j] == client_objects[k].token) {
                  console.log("messaging group member",msg.status);
                  client_objects[k].socket.emit('room_sensor', msg );
                }
              }*/
            }
          }
          console.log("room_sensor",msg);
        }
      }
    }

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
  });
  
  ws.on('error', function() {
    console.log('device websocket error catch!');
  });
});


function find_index(array, key, value) {
  for (var i=0; i < array.length; i++) {
    if (array[i][key] == value) {
      return i;
    }
  }
  return -1;
}

// -------------  socket.io server  ---------------- //
io.on('connection', function (socket) {
  console.info(socket.id + " | client connected" );

  socket.on('get token', function (data) {
    var public_ip = socket.request.connection.remoteAddress;
    public_ip = public_ip.slice(7);
    var device_name = data.device_name;
    var token = crypto.createHash('sha512').update(data.mac).digest('hex');
    var temp_object = Object.assign({}, data);
    temp_object.token = token;
    temp_object.public_ip = public_ip;
    socket.emit('get token',temp_object);
    store_client_object(temp_object);
    temp_object.socket = socket;
    var index = find_index(client_objects,'token',token);
    if (index < 0) {
      client_objects.push(temp_object);
      store_client_object(temp_object);
      console.log('added client',temp_object.mac);
    } else {
      client_objects[index] = temp_object;
      console.log('updated client',temp_object.mac);
    }
    
    var index = find_index(groups,'group_id',token);
    if (index < 0) {
      var group = {group_id:token, mode:'init', device_type:['alarm'], members:[]};
      groups.push(group);
      store_group(group);
    }
  });   






  socket.on('media', function (data) {
    var token = data.token;
    for (var i=0; i < client_objects.length; i++) {
      _socket = client_objects[i].socket;
      _token = client_objects[i].token;
      if (_token === token) {
        _socket.emit('media', data);
        console.log("media",data);
      }
    }
  });

  socket.on('set alarm', function (data) {
    store_group(data);
    socket.emit('alarm',data);
    console.log("set alarm", data);
  });

  socket.on('link device', function (data) {
    console.log("link device",data);
    var device_token = crypto.createHash('sha512').update(data.mac).digest('hex');
    var user_token = data.user_token;
    var device_name = data.device_name;
    for (var i=0; i < device_objects.length; i++) {
      if (device_objects[i].token == device_token) {
        device_objects[i].groups.push(user_token);
        device_objects[i].device_name = device_name;
        console.log('link device',device_objects[i]);
      }
    }
    for (var i=0; i < client_objects.length; i++) {
      if (client_objects[i].token == device_token) {
        client_objects[i].groups.push(user_token);
        client_objects[i].device_name = device_name;
        store_client_object(client_objects[i]);
        console.log('link device',client_objects[i]);
      }
    }
    for (var i=0; i < groups.length; i++) {
      // -- add device token as user member -- //
      if (groups[i].group_id == user_token) {
        groups[i].members.push(device_token);
        store_group(groups[i]);
      }
      // -- add user token as device member -- //
      if (groups[i].group_id == device_token) {
        groups[i].members.push(user_token);
        store_group(groups[i]);
      }
    }
    data.token = user_token;
    get_devices(data,socket);
  });

  socket.on('unlink device', function (data) {
    var device_token = crypto.createHash('sha512').update(data.mac).digest('hex');
    var user_token = data.user_token;

    var index = find_index(groups,'group_id',user_token);
    var index2 = groups[index].members.indexOf(device_token);
    groups[index].members.splice(index2,1);
    store_group(groups[index]);

    var index = find_index(client_objects,'token',device_token);
    var index2 = client_objects[index].groups.indexOf(user_token);
    client_objects[index].groups.splice(index,1);
    store_client_object(client_objects[index]);
    console.log('unlink device',groups[index]);
  });

  socket.on('garage_opener', function (data) {
    for (var i=0; i < device_objects.length; i++) {
      var _socket = device_objects[i].socket;
      var _token = device_objects[i].token;
      if (_token == data.token) {
        try { _socket.send('command' + data.command) }            
        catch (e) { console.log(e) };        
        console.log("garage_opener",data);
      }
    }
  });

  socket.on('siren', function (data) {
    for (var i=0; i < device_objects.length; i++) {
      var _socket = device_objects[i].socket;
      var _token = device_objects[i].token;
      if (_token == data.token) {
        try { _socket.send('command' + data.command) }            
        catch (e) { console.log(e) };        
        console.log("siren",data);
      }
    }
  });

  socket.on('set_mobile', function (data) {
    try { data = JSON.parse(data) }
    catch (e) { console.log("invalid json") }
    var server = data.server;
    console.log(data.server);
    var response = request.post(data.server, {form: data},
    function (error, response, data) {
        socket.emit('token',data);
        console.log("set_mobile.php | " + data);   
    });
  });

  socket.on('to mobile', function (data) {
    var token = data.token;
    for (var i=0; i < client_objects.length; i++) {
      _token = client_objects[i].token;
      if (_token && _token === token) {
        _socket = client_objects[i].socket;
        _mac = client_objects[i].mac;
        //console.log(_mac + " | to_mobile " + data.command);
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
        _socket.emit('from_mobile', data);
        //console.log(data.mac + " | from_mobile " + JSON.stringify(data));
      }
    }
  });

  socket.on('add_zwave_device', function (data) {
    var token = data.token;
    console.log("add_zwave_device | " + token);
    for (var i=0; i < client_objects.length; i++) {
      var _socket = client_objects[i].socket;
      var _token = client_objects[i].token;
      if (token && _token == token) {
        _socket.emit('add_zwave_device', data);
      }
    }
  });

  socket.on('link lights', function (data) {
    var token = data.token;
    for (var i=0; i < client_objects.length; i++) {
      var _socket = client_objects[i].socket;
      var _token = client_objects[i].token;
      var _mac = client_objects[i].mac; 
      if (_token === token) {
        _socket.emit('link lights', data);
        console.log("link lights",data);
      }
    }
  });

  socket.on('store_schedule', function (data) {
    var token = data.token;
    console.log("store_schedule | " + token);
    for (var i=0; i < client_objects.length; i++) {
      var _socket = client_objects[i].socket;
      var _token = client_objects[i].token;
      if (token && _token === token) {
    console.log("EMITTING store_schedule | " + data.token);
        _socket.emit('store_schedule', data);
      }
    }
  });


  socket.on('add thermostat', function (data) {
    var token = data.token;
    console.log("add thermostat | " + token);
    for (var i=0; i < client_objects.length; i++) {
      var _socket = client_objects[i].socket;
      var _token = client_objects[i].token;
      if (token && _token === token) {
        console.log("add thermostat | " + token);      
        _socket.emit('add thermostat', data);
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

  socket.on('get thermostat', function (data) {
    var token = data.token;
    console.log("get thermostat | " + token);
    for (var i=0; i < client_objects.length; i++) {
      var _socket = client_objects[i].socket;
      var _token = client_objects[i].token;
      if (token && _token === token) {
        _socket.emit('get thermostat', data);
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
        console.log("relayed device_info to clients");
      }
    }
  });

  socket.on('set zwave', function (data) {
    for (var i=0; i < client_objects.length; i++) {
      var _socket = client_objects[i].socket;
      var _token = client_objects[i].token;
      var _mac = client_objects[i].mac; 
      if (_token && _token === data.token) {
        _socket.emit('set zwave', data);
        console.log("set zwave",data);
      }
    }
  });
    
  socket.on('get devices', function (data) {
    get_devices(data,socket);
  });

  function get_devices(data,socket) {
    var devices = [];
    console.log('group_id',data.mac);
    var group_index = find_index(groups,'group_id',data.token);
    if (group_index < 0) return;
    console.log("group",groups[group_index]);
    devices.push(groups[group_index]);
    for (var i=0; i < groups[group_index].members.length; i++) {
      var client_index = find_index(client_objects,'token',groups[group_index].members[i]);
      if (client_index < 0)
        var device_index = find_index(device_objects,'token',groups[group_index].members[i]);
      if (client_objects[client_index]) {
        var temp_object = Object.assign({}, client_objects[client_index]);
        delete temp_object.socket;
        devices.push(temp_object);
      } else
      if (device_objects[device_index]) {
        var temp_object = device_objects[device_index];
        delete temp_object.socket
        devices.push(temp_object)
      }
      //var member_index = find_index(groups,'group_id',groups[group_index].members[i]);
      //groups[member_index].      
    }
    //console.log('get_devices',devices);
    socket.emit('get devices',{devices:devices});
  }

  socket.on('load devices', function (data) {
    var devices = [];
    var index = find_index(groups,'group_id',data.token);
    if (index < 0) return;

    for (var i=0; i < groups[index].members.length; i++) {
      var index2 = find_index(client_objects,'token',groups[index].members[i]);
      if (index2 < 0) return;
      if (client_objects[index2].socket) {
        console.log('load devices |',client_objects[index2].mac);
        client_objects[index2].socket.emit('load devices',data);
      } else {
        console.log("no socket |",client_objects[index2].mac);
      }
    }
  });

  socket.on('load settings', function (data) {
    var devices = [];
    var index = find_index(groups,'group_id',data.token);
    if (index < 0) return;

    for (var i=0; i < groups[index].members.length; i++) {
      var index2 = find_index(client_objects,'token',groups[index].members[i]);
      if (index2 < 0) return;
      if (client_objects[index2].socket) {
        //var temp_object = Object.assign({}, client_objects[index2]);
        //delete temp_object.socket;
        console.log('load settings |',data.mac);
        client_objects[index2].socket.emit('load settings',data);
      } else {
        console.log("load settings | no socket |",client_objects[index2].mac);
      }
    }
  });

  socket.on('set settings', function (data) {
    for (var i=0; i < client_objects.length; i++) {
      var _socket = client_objects[i].socket;
      var _token = client_objects[i].token;
      if (_token && _token === data.token) {
        _socket.emit('set settings', data);
        console.log(data.mac + " | set settings " + data);
      }
    }
  });

  socket.on('get settings', function (data) {
    var index = find_index(groups,'group_id',data.token);
    if (index < 0) return;

    for (var i=0; i < groups[index].members.length; i++) {
      var index2 = find_index(client_objects,'token',groups[index].members[i]);
      if (client_objects[index2]) {
        if (client_objects[index2].socket) {
          client_objects[index2].socket.emit('get settings',data);
        }
      }
    }
  });

  socket.on('gateway', function (data) {
    var token = data.token;
    var array_size = client_objects.length;
    for (var i=0; i < array_size; i++) {
      var _socket = client_objects[i].socket;
      var _token = client_objects[i].token;
      var _mac = client_objects[i].mac; 
      if (_token && _token === token) {
        //_socket.emit('gateway', data);
        //i = client_objects.length; //to exist loop, should work without this?
        _socket.emit('gateway', data);
        console.log(_mac + " | relayed data to gateway ");
      }
    }
  });
  
/*  socket.on('png_test', function (data) {
    try { data = JSON.parse(data) }
    catch (e) { console.log("invalid json") }
    //console.log(data.mac + " | received ping, sending reply");
    socket.emit('png_test',{command:"ping!"});
    timeout();
function timeout() {
    setTimeout(function () {
        console.log(socket.id + ' | ping!');
        socket.emit('png_test',{ping:"ping!"});
        timeout();
    }, 10000);
}
  });*/

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

