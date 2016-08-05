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
var util = require('../util');

var Account = require('../ethereum/account');

module.exports = function(services) {
  var sandbox = services.sandbox;
  return {
    setBreakpoints: {
      args: [{
        type: 'array',
        values: {
          type: 'map',
          values: {
            line: { type: 'number' },
            column: { type: 'number' },
            source: { type: 'string' }
          }
        }
      }],
      handler: function(breakpoints, cb) {
        sandbox.setBreakpoints(breakpoints, cb);
      }
    },
    newBreakpointFilter: {
      args: [],
      handler: function(cb) {
        cb(null, sandbox.filters.addBreakpointFilter());
      }
    },
    getFilterChanges: {
      args: [{ type: 'hex' }],
      handler: function(filterId, cb) {
        cb(null, sandbox.filters.getChanges(filterId));
      }
    },
    uninstallFilter: {
      args: [{ type: 'hex' }],
      handler: function(filterId, cb) {
        sandbox.filters.removeFilter(filterId);
        cb();
      }
    },
    resume: {
      args: [],
      handler: function(cb) {
        sandbox.resume(cb);
      }
    },
    stepInto: {
      args: [],
      handler: function(cb) {
        sandbox.stepInto(cb);
      }
    }
  };
};
