var _ = require('lodash');
var jayson = require('jayson');
var Sandbox = require('./sandbox/sandbox');
var util = require('./util');
var sandboxApi = require('./api/sandbox');
var ethApi = require('./api/eth');
var netApi = require('./api/net');
var web3Api = require('./api/web3');
var parse = require('./types/parse');

function service(sandbox) {
  return {
    sandbox: sandboxApi(sandbox),
    eth: ethApi(sandbox),
    net: netApi(sandbox),
    web3: web3Api(sandbox)
  };
}

var Control = {
  services: {},
  contains: function(id) {
    return this.services.hasOwnProperty(id);
  },
  create: function(cb) {
    var id = util.generateId();
    var sandbox = Object.create(Sandbox);
    sandbox.init(id, (function(err) {
      if (err) cb(err);
      else {
        var handlers =_.transform(service(sandbox), function(result, calls, prefix) {
          _.each(calls, function(call, name) {
            result[prefix + '_' + name] = withValidator(call);
          });
        });

        this.services[id] = {
          instance: sandbox,
          middleware: jayson.server(handlers, { collect: true }).middleware()
        };
        
        cb(null, this.services[id]);
      }
    }).bind(this));
  },
  service: function(id) {
    return this.services[id];
  },
  stop: function(id) {
    if (!this.services.hasOwnProperty(id)) return;
    var service = this.services[id];
    service.instance.stop(function() {});
    delete this.services[id];
  },
  reset: function() {
    _.each(this.services, function(service) {
      service.instance.stop(function() {});
    });
    this.services = {};
  }
};

function withValidator(call) {
  return function() {
    var args = arguments[0];
    var cb = util.jsonRpcCallback(arguments[1]);
    if (args.length !== call.args.length) cb('Wrong number of arguments');
    else {
      var errors = [];
      args = _.map(args, function(arg, index) {
        return parse(arg, call.args[index], errors);
      });
      args.push(cb);
      if (errors.length === 0) call.handler.apply(null, args);
      else cb(errors.join(' '));
    }
  };
}

module.exports = Control;
