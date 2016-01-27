var _ = require('lodash');
var async = require('async');
var jayson = require('jayson');
var Sandbox = require('./sandbox/sandbox');
var util = require('./util');
var sandboxApi = require('./api/sandbox');
var ethApi = require('./api/eth');
var netApi = require('./api/net');
var web3Api = require('./api/web3');
var parse = require('./types/parse');

var unusedTime = 30 * 60 * 1000;
var checkPeriod = 15 * 60 * 1000;

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
  create: function(id, cb) {
    if (!id) id = util.generateId();

    async.series([
      this.stop.bind(this, id),
      start.bind(this)
    ], cb);

    function start() {
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
            lastTouch: Date.now(),
            instance: sandbox,
            middleware: jayson.server(handlers, { collect: true }).middleware()
          };
          
          cb(null, this.services[id]);
        }
      }).bind(this));
    }
  },
  service: function(id) {
    var service = this.services[id];
    service.lastTouch = Date.now();
    return service;
  },
  stop: function(id, cb) {
    if (!this.services.hasOwnProperty(id)) return cb();
    var service = this.services[id];
    service.instance.stop((function(err) {
      delete this.services[id];
      cb(err);
    }).bind(this));
  },
  reset: function(cb) {
    async.forEachOf(this.services, function(service, id, cb) {
      service.instance.stop(cb);
    }, (function(err) {
      this.services = {};
      cb(err);
    }).bind(this));
  },
  stopUnused: function() {
    var now = Date.now();
    _(this.services)
      .filter(function(service) {
        return service.lastTouch < now - unusedTime;
      })
      .each((function(service) {
        this.stop(service.instance.id, function(err){
          if (err) console.error(err);
        });
      }).bind(this))
      .value();
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

setInterval(Control.stopUnused.bind(Control), checkPeriod);

module.exports = Control;
