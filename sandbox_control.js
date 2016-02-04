var _ = require('lodash');
var async = require('async');
var jayson = require('jayson');
var Sandbox = require('./sandbox/sandbox');
var Compiler = require('./compiler');
var util = require('./util');
var sandboxApi = require('./api/sandbox');
var ethApi = require('./api/eth');
var netApi = require('./api/net');
var web3Api = require('./api/web3');
var withValidator = require('./types/validator').withValidator;

var unusedTime = 30 * 60 * 1000;
var checkPeriod = 15 * 60 * 1000;

function createCalls(sandbox) {
  return {
    sandbox: sandboxApi(sandbox),
    eth: ethApi(sandbox),
    net: netApi(sandbox),
    web3: web3Api(sandbox)
  };
}

var Control = {
  instances: {},
  init: function(events) {
    this.events = events;
    return this;
  },
  contains: function(id) {
    return this.instances.hasOwnProperty(id);
  },
  create: function(id, cb) {
    if (!id) id = util.generateId();

    async.series([
      this.stop.bind(this, id),
      start.bind(this)
    ], cb);

    function start() {
      var services = {
        sandbox: Object.create(Sandbox),
        compiler: Object.create(Compiler)
      };
      
      services.sandbox.init(id, (function(err) {
        if (err) cb(err);
        else {
          this.events.emit('sandboxStart', services);
          
          var handlers =_.transform(createCalls(services), function(result, calls, prefix) {
            _.each(calls, function(call, name) {
              result[prefix + '_' + name] = withValidator(call);
            });
          });

          this.instances[id] = {
            id: id,
            lastTouch: Date.now(),
            services: services,
            middleware: jayson.server(handlers, { collect: true }).middleware()
          };

          cb(null, this.instances[id]);
        }
      }).bind(this));
    }
  },
  instance: function(id) {
    var instance = this.instances[id];
    instance.lastTouch = Date.now();
    return instance;
  },
  stop: function(id, cb) {
    if (!this.instances.hasOwnProperty(id)) return cb();
    var instance = this.instances[id];
    instance.services.sandbox.stop((function(err) {
      delete this.instances[id];
      cb(err);
    }).bind(this));
  },
  reset: function(cb) {
    async.forEachOf(this.instances, function(instance, id, cb) {
      instance.services.sandbox.stop(cb);
    }, (function(err) {
      this.instances = {};
      cb(err);
    }).bind(this));
  },
  stopUnused: function() {
    var now = Date.now();
    _(this.instances)
      .filter(function(instance) {
        return instance.lastTouch < now - unusedTime;
      })
      .each((function(instance) {
        this.stop(instance.id, function(err){
          if (err) console.error(err);
        });
      }).bind(this))
      .value();
  }
};


setInterval(Control.stopUnused.bind(Control), checkPeriod);

module.exports = Control;
