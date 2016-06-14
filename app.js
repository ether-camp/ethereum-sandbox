var http = require('http');
var fork = require('child_process').fork;
var express = require('express');
var cors = require('cors');
var app = express();
var bodyParser = require('body-parser');
var _ = require('lodash');
var EventEmitter = require('events').EventEmitter;
var events = new EventEmitter();
var Control = require('./sandbox_control');
var plugins = require('./plugins');

plugins.load(events);

var server, control, unusedWatcher;
var lastTouch = Date.now();
var defaultPort = 8555;
var testModeUnusedLifetime = 15 * 1000;
var testModeUnusedCheckInterval = 10 * 1000;

function start(testMode, port, cb) {
  if (_.isFunction(port)) {
    cb = port;
    port = defaultPort;
  }
  
  control = Control.init(events);
  
  app.use(cors());
  app.use(bodyParser.json());
  
  if (testMode) {
    app.use(function(req, res, next) {
      lastTouch = Date.now();
      next();
    });
  }
  
  app.post('/sandbox', function(req, res) {
    control.create(req.query.id, req.body, function(err, instance) {
      if (err) res.status(500).send(err);
      else res.json({ id: instance.id });
    });
  });
  app.post('/sandbox/:id', function(req, res, next) {
    if (!control.contains(req.params.id)) res.sendStatus(404);
    else control.instance(req.params.id).middleware(req, res, next);
  });
  app.delete('/sandbox/:id', function(req, res, next) {
    if (!control.contains(req.params.id)) res.sendStatus(404);
    else {
      control.stop(req.params.id, function(err) {
        if (err) res.status(500).send(err);
        else res.sendStatus(200);
      });
    }
  });
  app.get('/sandbox', function(req, res) {
    res.json(_.keys(control.instances));
  });
  app.post('/reset', function(req, res) {
    control.reset(function(err) {
      if (err) res.status(500).send(err);
      else res.sendStatus(200);
    });
  });
  
  server = app.listen(port, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Sandbox is listening at http://%s:%s', host, port);
    if (cb) cb();
  });
  
  if (testMode) {
    unusedWatcher = setInterval(stopIfUnused, testModeUnusedCheckInterval);
  }
}

function stopIfUnused() {
  if (Date.now() > lastTouch + testModeUnusedLifetime) stop();
}

function startDetached(port, cb) {
  console.log('starting');
  if (_.isFunction(port)) {
    cb = port;
    port = defaultPort;
  }
  
  fork(__filename, [ '--test', '--port=' + port ]);
  var checksNum = 15;
  var check = setInterval(function() {
    http.get('http://localhost:' + port, function() {
      clearInterval(check);
      cb();
    }).on('error', function() {
      if (checksNum-- == 0) {
        clearInterval(check);
        cb('Sandbox has not been started');
      }
    });
  }, 1000);
}

function stop() {
  if (unusedWatcher) {
    console.log('Stopping the sandbox.');
    clearInterval(unusedWatcher);
  }
  control.reset();
  control.stopWatchingUnused();
  server.close();
}

if (require.main === module) {
  var testMode = false;
  var port = defaultPort;
  process.argv.forEach(function(arg) {
    if (arg == '--test') testMode = true;
    if (arg.indexOf('--port=') == 0) port = arg.substr(7);
  });
  start(testMode, port);
} else {
  module.exports = {
    start: start.bind(null, true),
    startDetached: startDetached,
    stop: stop
  };
}
