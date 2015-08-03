var express = require('express');
var cors = require('cors');
var app = express();
var jayson = require('jayson');
var bodyParser = require('body-parser');
var _ = require('lodash');
var crypto = require('crypto');
var Sandbox = require('./sandbox');
var SHA3Hash = require('sha3').SHA3Hash;
var util = require('./util');

var sandboxes = {};

function jsonRpcCallback(cb) {
  return function(err, reply) {
    if (err) err = { code: 0, message: err };
    if (reply === undefined) reply = null;
    cb(err, reply);
  };
}

function createSandbox(id) {
  var sandbox = Object.create(Sandbox).init();
  sandboxes[id].instance = sandbox;
  return jayson.server({
    sandbox_id: function(cb) {
      cb(null, id);
    },
    sandbox_createAccounts: function(accounts, cb) {
      sandbox.createAccounts(accounts, jsonRpcCallback(cb));
    },
    sandbox_setBlock: function(block, cb) {
      sandbox.setBlock(block);
      cb(null, true);
    },
    sandbox_predefinedAccounts: function(cb) {
      cb(null, sandbox.accounts);
    },
    sandbox_accounts: function(cb) {
      sandbox.getAccounts(jsonRpcCallback(cb));
    },
    sandbox_runTx: function(options, cb) {
      sandbox.runTx(options, jsonRpcCallback(cb));
    },
    sandbox_transactions: function(cb) {
      cb(null, sandbox.transactions);
    },
    sandbox_contracts: function(cb) {
      cb(null, sandbox.contracts);
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
      cb(null, "59");
    },
    net_listening: function(cb) {
      cb(null, true);
    },
    web3_clientVersion: function(cb) {
      cb(null, 'ethereum-sandbox/v0.0.1');
    },
    web3_sha3: function(str, cb) {
      cb = jsonRpcCallback(cb);
      try {
        var buf = new Buffer(util.fromHex(str), 'hex');
      } catch (e) {
        return cb(e.message);
      }
      var sha = new SHA3Hash(256);
      sha.update(buf);
      cb(null, util.toHex(sha.digest('hex')));
    }
  }).middleware();
}

app.use(cors());
app.use(bodyParser.json());
app.post('/sandbox', function(req, res) {
  var id = generateId();
  sandboxes[id] = {};
  sandboxes[id].middleware = createSandbox(id);
  res.json({ id: id });
});
app.post('/sandbox/:id', function(req, res, next) {
  if (!sandboxes.hasOwnProperty(req.params.id)) res.sendStatus(404);
  else sandboxes[req.params.id].middleware(req, res, next);
});
app.delete('/sandbox/:id', function(req, res, next) {
  if (!sandboxes.hasOwnProperty(req.params.id)) res.sendStatus(404);
  else {
    sandboxes[req.params.id].instance.stop(function() {});
    delete sandboxes[req.params.id];
    res.sendStatus(200);
  }
});
app.get('/sandbox', function(req, res) {
  res.json(_.keys(sandboxes));
});
app.post('/reset', function(req, res) {
  _.each(sandboxes, function(sandbox, key) {
    sandbox.instance.stop(function() {});
  });
  sandboxes = [];
  res.sendStatus(200);
});

var server = app.listen(8555, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('Sandbox is listening at http://%s:%s', host, port);
});

function generateId() {
  var now = (new Date()).valueOf().toString();
  var seed = Math.random().toString();
  return crypto.createHash('sha1').update(now + seed).digest('hex');
}
