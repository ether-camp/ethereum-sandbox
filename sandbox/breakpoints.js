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
 
var util = require('../util');
var _ = require('lodash');

var Breakpoints = {

  init: function() {
    this.array = [];
    return this;
  },

  destroy: function() {
    this.array = null;
  },

  setBreakpoints: function(breakpoints) {
    _.each(breakpoints, this.addBreakpoint.bind(this));
  },

  removeBreakpoints: function(breakpoints) {
    _.each(breakpoints, this.removeBreakpoint.bind(this));
  },

  addBreakpoint: function(bp) {
    bp = {
      line: bp.line.toNumber(),
      source: bp.source
    };
    if (!_.contains(this.array, bp)) {
      this.array.push(bp);
    }
  },

  removeBreakpoint: function(bp) {
    bp = {
      line: bp.line.toNumber(),
      source: bp.source
    };
    _.remove(this.array, bp);
  }

};

module.exports = Breakpoints;
