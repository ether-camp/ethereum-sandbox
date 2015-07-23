var express = require('express');
var app = express();
var jayson = require('jayson');
var bodyParser = require('body-parser');
var _ = require('lodash');
var crypto = require('crypto');

var jsonrpc = jayson.server({
  echo: function(phrase, callback) {
    callback(null, phrase);
  }
});

app.use(bodyParser.json());
app.post('/create-sandbox', function(req, res) {
  var reply = { id: generateId() };
  res.json(reply);
});
app.post('/', jsonrpc.middleware());

var server = app.listen(8545, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('Sandbox is listening at http://%s:%s', host, port);
});

function generateId() {
  var now = (new Date()).valueOf().toString();
  var seed = Math.random().toString();
  return crypto.createHash('sha1').update(now + seed).digest('hex');
}
