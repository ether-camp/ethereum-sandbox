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

var solc = require('solc');
var _ = require('lodash');

var Compiler = {
  compile: function(source, cb) {
    var output = solc.compile({ sources: { 'contract.sol': source } }, 1);
    cb(
      output.errors,
      _(output.contracts)
        .map(function(details, name) {
          return [ name, {
            code: '0x' + details.bytecode,
            info: {
              source: source,
              abiDefinition: JSON.parse(details.interface),
              userDoc: { methods: {} },
              developerDoc: { methods: {} }
            }
          }];
        })
        .object()
        .value()
    );
  }
};

module.exports = Compiler;
