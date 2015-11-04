var express = require('express');
var cors = require('cors');
var app = express();
var jayson = require('jayson');
var bodyParser = require('body-parser');
var _ = require('lodash');
var control = require('./sandbox_control');

app.use(cors());
app.use(bodyParser.json());
app.post('/sandbox', function(req, res) {
  control.create(function(err, service) {
    if (err) res.status(500).send(err);
    else res.json({ id: service.instance.id });
  });
});
app.post('/sandbox/:id', function(req, res, next) {
  if (!control.contains(req.params.id)) res.sendStatus(404);
  else control.service(req.params.id).middleware(req, res, next);
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
  res.json(_.keys(control.services));
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
});
