/*
 * Ethereum Sandbox
 * Copyright (C) 2016  <ether.camp> ALL RIGHTS RESERVED  (http://ether.camp)
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License version 3 for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
 
var _ = require('lodash');
var async = require('async');
var jayson = require('jayson');
var Sandbox = require('./sandbox/sandbox');
var Compiler = require('./compiler');
var util = require('./util');
var withValidator = require('./types/validator').withValidator;

var unusedTime = 30 * 60 * 1000;
var checkPeriod = 15 * 60 * 1000;

var apis = {
  sandbox: require('./api/sandbox'),
  eth: require('./api/eth'),
  net: require('./api/net'),
  web3: require('./api/web3')
};

function createCalls(apis, services) {
  return _(apis)
    .map(function(creator, name) {
      return [ name, creator(services) ];
    })
    .object()
    .value();
}

var Control = {
  instances: {},
  init: function(events) {
    this.events = events;
    this.watchUnused();
    return this;
  },
  contains: function(id) {
    return this.instances.hasOwnProperty(id);
  },
  create: function(id, config, cb) {
    if (!id) id = util.generateId();
    if (!config) config = {};
    if (!config.hasOwnProperty('plugins')) config.plugins = {};
    
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
          var instanceServices = _.clone(services);
          var instanceApis = _.clone(apis);
          this.events.emit('sandboxStart', config, instanceServices, instanceApis);

          var handlers =_.transform(createCalls(instanceApis, instanceServices), function(result, calls, prefix) {
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
      if (cb) cb(err);
    }).bind(this));
  },
  watchUnused: function() {
    this.unusedWatcher = setInterval(this.stopUnused.bind(this), checkPeriod);
  },
  stopWatchingUnused: function() {
    clearInterval(this.unusedWatcher);
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

module.exports = Control;
