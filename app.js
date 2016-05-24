var express = require('express');
var cors = require('cors');
var app = express();
var jayson = require('jayson');
var bodyParser = require('body-parser');
var _ = require('lodash');
var EventEmitter = require('events').EventEmitter;
var events = new EventEmitter();
var control = require('./sandbox_control').init(events);
var plugins = require('./plugins');

plugins.load(events);

function start(cb) {
  app.use(cors());
  app.use(bodyParser.json());
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
  
  var server = app.listen(8555, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Sandbox is listening at http://%s:%s', host, port);
    if (cb) cb();
  });
}

if (require.main === module) start();
else module.exports = { start: start };
