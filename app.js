var express = require('express');
var app = express();
var jayson = require('jayson');
var bodyParser = require('body-parser');

var jsonrpc = jayson.server({
  echo: function(phrase, callback) {
    callback(null, phrase);
  }
});

app.use(bodyParser.json());
//app.post('/create-sandbox', function(req, res) {
//});
app.post('/', jsonrpc.middleware());

var server = app.listen(8545, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('Sandbox is listening at http://%s:%s', host, port);
});
