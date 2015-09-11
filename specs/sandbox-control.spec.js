var jayson = require('jayson');
var request = require('request');
var _ = require('lodash');
var async = require('async');

var baseUrl = 'http://localhost:8555/',
    sandboxUrl = baseUrl + 'sandbox/';

describe('Sandbox control', function() {
  afterEach(request.post.bind(request, baseUrl + 'reset'));

  it('Creates a new sandbox', function(done) {
    request.post({ url: sandboxUrl, json: true }, function(err, res, reply) {
      if (err) return done(err);
      var id = reply.id;
      request({ url: sandboxUrl, json: true }, function(err, res, reply) {
        if (err) return done.fail(err);
        done(_.contains(reply, id) ?
             null : 'There is no the sandbox in the sandboxes list');
      });
    });
  });

  it('Stoppes a sandbox', function(done) {
    async.waterfall([
      createSandbox,
      check,
      stop,
      check
    ], done);
    
    function createSandbox(cb) {
      request.post({ url: sandboxUrl, json: true }, function(err, res, reply) {
        cb(err, reply.id);
      });
    }
    function check(id, cb) {
      request({ url: sandboxUrl, json: true }, function(err, res, reply) {
        if (err) return cb(err);
        if (id) {
          cb(
            _.contains(reply, id) ?
              null : 'The sandboxes list does not contain the sandbox',
            id
          );
        } else {
          cb(reply.length === 0 ? null : 'The sandboxes list should be empty', id);
        }
      });
    }
    function stop(id, cb) {
      request.del(sandboxUrl + id, function(err, res) {
        if (err) cb(err);
        else cb(res.statusCode === 200 ? null : 'Response status ' + res.statusCode, null);
      });
    }
  });
  
  it('Routes calls to sandboxes by id', function(done) {
    async.parallel([
      createSandbox,
      createSandbox
    ], function (err, ids) {
      async.each(ids, function(id, cb) {
        var client = jayson.client.http(sandboxUrl + id);
        client.request('sandbox_id', [], function(err, reply) {
          if (err) cb(err);
          else if (reply.error) cb(reply.error.message);
          else cb(reply.result === id ?
                  null : 'Expected id ' + id + ' but got ' + reply.result);
        });
      }, done);
    });

    function createSandbox(cb) {
      request.post({ url: sandboxUrl, json: true }, function(err, res, reply) {
        cb(err, reply.id);
      });
    }
  });
});

