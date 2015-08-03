var jayson = require('jayson');
var _ = require('lodash');
var async = require('async');
var request = require('request');
var fs = require('fs');
var util = require('util');

var baseUrl = 'http://localhost:8555/',
    sandboxUrl = baseUrl + 'sandbox/';

describe('Sandbox JSON RPC', function() {
  afterEach(request.post.bind(request, baseUrl + 'reset'));

  describe('sandbox_* calls', run.bind(null, './specs/sandbox-json-rpc.json'));
  describe('web3_* calls', run.bind(null, './specs/web3-json-rpc.json'));
  describe('net_* calls', run.bind(null, './specs/net-json-rpc.json'));
  describe('eth_* calls', run.bind(null, './specs/eth-json-rpc.json'));
});

function run(file) {
  var tests = JSON.parse(fs.readFileSync(file));
  _.each(tests, function(calls, name) {
    it(name, function(done) {
      request.post({ url: sandboxUrl, json: true }, function(err, res, reply) {
        if (err) return done(err);
        var client = jayson.client.http(sandboxUrl + reply.id);
        async.forEachOfSeries(calls, function(info, name, cb) {
          client.request(name, info.params, function(err, reply) {
            if (err) {
              cb(name + ' has failed with the error: ' + err);
            } else if (reply.hasOwnProperty('error')) {
              return cb(name + ' has failed with the json-rpc error: ' + reply.error.message);
            } else cb(
              _.isEqual(reply.result, info.result) ?
                null :
                util.format(
                  '%s result is not correct. Expected %j got %j',
                  name, info.result, reply.result
                )
            );
          });
        }, done);
      });
    });
  });
}
