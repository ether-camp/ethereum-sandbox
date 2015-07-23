var spawn = require('child_process').spawn;
var jayson = require('jayson');
var http = require('http');
var urlparser = require('url');
var _ = require('lodash');
var async = require('async');

require('jasmine-expect');

describe('Sandbox', function() {
  var app;
  
  beforeAll(function(done) {
    app = spawn('node', ['app.js']);
    app.on('error', function(err) {
      console.error(err);
      done.fail();
    });
    app.stdout.on('data', function(data) {
      if (_.startsWith(data.toString(), 'Sandbox is listening')) done();
    });
    app.stderr.on('data', function(data) {
      var err = data.toString();
      console.log(err);
      done.fail(err);
    });
  });

  afterAll(function() {
    app.kill();
  });

  it('Create a new sandbox', function(done) {
    post('http://localhost:8545/create-sandbox', function(err, res, reply) {
      if (err) return done.fail(err);
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toStartWith('application/json');
      expect(reply).toHaveNonEmptyString('id');
      done();
    });
  });
  
  it('Handle net_version call', function(done) {
    async.waterfall([
      createSandbox,
      call
    ], function(err, reply) {
      if (err) return done.fail(err);
      expect(reply.result).toMatch(/^\d+$/);
      done();
    });

    function call(id, cb) {
      var client = jayson.client.http('http://localhost:8545/' + id);
      client.request('net_version', [], cb);
    }
  });

  it('Route messages to sandboxes by id', function(done) {
    async.parallel([
      createSandbox,
      createSandbox
    ], function (err, ids) {
      async.each(ids, function(id, cb) {
        var client = jayson.client.http('http://localhost:8545/' + id);
        client.request('sandbox_id', [], function(err, reply) {
          if (err) return cb(err);
          expect(reply.result).toBe(id);
          cb();
        });
      }, function(err) {
        if (err) done.fail(err);
        else done();
      });
    });
  });
});

function post(url, cb) {
  var options = urlparser.parse(url);
  options.method = 'POST';
  var req = http.request(options, function(res) {
    var body = '';
    res.on('data', function(chunk) { body += chunk; });
    res.on('end', function() {
      try {
        var reply = JSON.parse(body);
      } catch (e) {
        return cb(e);
      }
      cb(null, res, reply);
    });
  });
  req.on('error', cb);
  req.end();
}

function createSandbox(cb) {
  post('http://localhost:8545/create-sandbox', function(err, res, reply) {
    if (err) cb(err);
    else cb(null, reply.id);
  });
}
