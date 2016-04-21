var cool = require('cool-ascii-faces');
var express = require('express');
var app = express();
var pg = require('pg');
var http = require('http');

var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

    // intercept OPTIONS method
    if ('OPTIONS' == req.method) {
      res.send(200);
    }
    else {
      next();
    }
};
app.use(allowCrossDomain);

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  response.render('pages/index');
});

require('socketio-auth')(io, {
  authenticate: function (socket, data, callback) {
    //get credentials sent by the client
    var username = data.username;
    var password = data.password;
    console.log('someone trying to authenticate...');
    //db.findUser('User', {username:username}, function(err, user) {

      //inform the callback of auth success/failure
      //if (err || !user) return callback(new Error("User not found"));
      return callback(null, user.password == password);
    //}
  }
});

app.get('/cool', function(request, response) {
  response.send(cool());
});

app.get('/db', function (request, response) {
  pg.connect(process.env.DATABASE_URL, function(err, client, done) {
    client.query('SELECT * FROM test_table', function(err, result) {
      done();
      if (err)
       { console.error(err); response.send("Error " + err); }
      else
       { response.render('pages/db', {results: result.rows} ); }
    });
  });
})

var server = http.createServer(app);
var io = require('socket.io').listen(server);
console.log('starting io server');

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

// And finally some websocket stuff
io.on('connection', function (socket) { // Incoming connections from clients
  console.log('someone connected');
  // Greet the newcomer
  socket.emit('hello', { greeting: 'Hi socket ' + socket.id + ' this is Server speaking! Let\'s play ping-pong. You pass!' });

  socket.on('ping', function (data) { // ping-event from the client to be respond with pong
    console.log("received ping from client: ", data);
    socket.emit('pong', { id: data.id });
  });
});
