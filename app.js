var express = require('express');
var app = express();
var jayson = require('jayson');
var bodyParser = require('body-parser');
var _ = require('lodash');
var crypto = require('crypto');

function createSandbox(id) {
  return jayson.server({
    sandbox_id: function(cb) {
      cb(null, id);
    },
    net_version: function(cb) {
      cb(null, '59');
    }
  }).middleware();
}

app.use(bodyParser.json());
app.post('/create-sandbox', function(req, res) {
  var id = generateId();
  app.post('/' + id, createSandbox(id));
  res.json({ id: id });
});

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
