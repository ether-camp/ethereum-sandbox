var express = require('express');
var app = express();
var jayson = require('jayson');
var bodyParser = require('body-parser');
var _ = require('lodash');
var crypto = require('crypto');
var Sandbox = require('./sandbox');

function jsonRpcCallback(cb) {
  return function(err, reply) {
    if (err) err = { code: 0, message: err };
    if (reply === undefined) reply = null;
    cb(err, reply);
  };
}

function createSandbox(id) {
  var sandbox = Object.create(Sandbox).init();
  return jayson.server({
    sandbox_id: function(cb) {
      cb(null, id);
    },
    sandbox_start: function(env, cb) {
      sandbox.start(env, jsonRpcCallback(cb));
    },
    sandbox_accounts: function(cb) {
      sandbox.getAccounts(jsonRpcCallback(cb));
    },
    sandbox_env: function(cb) {
      cb(null, sandbox.env);
    },
    sandbox_runTx: function(options, cb) {
      sandbox.runTx(options, jsonRpcCallback(cb));
    },
    eth_newFilter: function(options, cb) {
      sandbox.newFilter(options, jsonRpcCallback(cb));
    },
    eth_newPendingTransactionFilter: function(cb) {
      sandbox.newFilter('pending', jsonRpcCallback(cb));
    },
    eth_uninstallFilter: function(filterId, cb) {
      sandbox.removeFilter(filterId, jsonRpcCallback(cb));
    },
    eth_getFilterChanges: function(filterId, cb) {
      sandbox.getFilterChanges(filterId, jsonRpcCallback(cb));
    },
    eth_getFilterLogs: function(filterId, cb) {
      sandbox.getFilterChanges(filterId, jsonRpcCallback(cb));
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
