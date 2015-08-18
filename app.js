var express = require('express');
var cors = require('cors');
var app = express();
var jayson = require('jayson');
var bodyParser = require('body-parser');
var _ = require('lodash');
var Sandbox = require('./sandbox');
var util = require('./util');
var sandboxApi = require('./api/sandbox');
var ethApi = require('./api/eth');
var netApi = require('./api/net');
var web3Api = require('./api/web3');

var services = {};

function service(sandbox) {
  return {
    sandbox: sandboxApi(sandbox),
    eth: ethApi(sandbox),
    net: netApi(sandbox),
    web3: web3Api(sandbox)
  };
}

function createSandboxService(id, cb) {
  var sandbox = Object.create(Sandbox);
  sandbox.init(id, function(err) {
    if (err) cb(err);
    else cb(null, {
      instance: sandbox,
      middleware: jayson.server(
        _.reduce(service(sandbox), util.collapse('', '_'), {})
      ).middleware()
    });
  });
}

app.use(cors());
app.use(bodyParser.json());
app.post('/sandbox', function(req, res) {
  var id = util.generateId();
  createSandboxService(id, function(err, service) {
    if (err) res.status(500).send(err);
    else {
      services[id] = service;
      res.json({ id: id });
    }
  });
});
app.post('/sandbox/:id', function(req, res, next) {
  if (!services.hasOwnProperty(req.params.id)) res.sendStatus(404);
  else services[req.params.id].middleware(req, res, next);
});
app.delete('/sandbox/:id', function(req, res, next) {
  if (!services.hasOwnProperty(req.params.id)) res.sendStatus(404);
  else {
    services[req.params.id].instance.stop(function() {});
    delete services[req.params.id];
    res.sendStatus(200);
  }
});
app.get('/sandbox', function(req, res) {
  res.json(_.keys(services));
});
app.post('/reset', function(req, res) {
  _.each(services, function(sandbox, key) {
    sandbox.instance.stop(function() {});
  });
  services = [];
  res.sendStatus(200);
});

var server = app.listen(8555, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('Sandbox is listening at http://%s:%s', host, port);
});
