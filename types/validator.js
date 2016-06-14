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
var util = require('../util');
var parse = require('./parse');

module.exports.withValidator = function(call) {
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
};
