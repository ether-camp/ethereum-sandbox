var jayson = require('jayson');
var _ = require('lodash');
var async = require('async');
var request = require('request');
var fs = require('fs');
var util = require('util');

var baseUrl = 'http://localhost:8555/',
    sandboxUrl = baseUrl + 'sandbox/';

describe('Sandbox JSON RPC', function() {
  this.timeout(5000);
  
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
        var results = [];
        async.forEachSeries(calls, function(info, cb) {
          substituteParams(info.params);
          
          if (info.wait) async.retry({ times: 6, interval: 500 }, call, withResultSave(cb))
          else call(withResultSave(cb));

          function withResultSave(cb) {
            return function(err, result) {
              results.push(result);
              cb(err);
            };
          }
          function call(cb) {
            client.request(info.name, info.params, function(err, reply) {
              if (err) {
                cb(info.name + ' has failed with the error: ' + err);
              } else {
                if (info.hasOwnProperty('result')) {
                  if (reply.hasOwnProperty('error')) {
                    cb(info.name + ' has failed with the json-rpc error: ' + reply.error.message);
                  } else {
                    cb(
                      isEqual(reply.result, info.result) ?
                        null :
                        util.format(
                          '%s result is not correct. Expected %j got %j',
                          info.name, info.result, reply.result
                        ),
                      reply.result
                    );

                    function isEqual(target, source) {
                      var targetType = typeof target;
                      var sourceType = typeof source;
                      if (targetType !== sourceType) return false;
                      if (source === null) return target === source;
                      if (targetType === 'object' && source !== null) {
                        return _.size(target) == _.size(source) &&
                          _.every(target, function(value, key) {
                            return isEqual(value, source[key]);
                          });
                      }
                      if (typeof source === 'string' && /^\/.+\/$/.test(source)) {
                        var pattern = source.substr(1, source.length - 2);
                        return new RegExp(pattern).test(target);
                      }
                      return target === source;
                    }
                  }
                } else if (info.hasOwnProperty('error')) {
                  cb(
                    _.isEqual(reply.error.message, info.error) ?
                      null :
                      util.format(
                        '%s error is not correct. Expected %j got %j',
                        info.name, info.error, reply.error.message
                      )
                  );
                } else cb();
              }
            });
          }
        }, done);

        function substituteParams(params) {
          _.each(params, function(param, key) {
            var type = typeof param;
            if (type == 'object' && param != null) {
              substituteParams(param);
            } else if (type == 'string' && /^\{.+\}$/.test(param)) {
              params[key] = _.get(results, param.substr(1, param.length - 2));
            }
          });
        }
      });
    });
  });
}
