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
 
var EthVM = require('ethereumjs-vm');
var Debugger = require('./debugger');
var util = require('../util');
var _ = require('lodash');

var VM = {

  init: function(optionsOrVm, sandbox, withDebug, hashDict) {

    var self = this;
    
    this.ethVm = optionsOrVm instanceof EthVM ? optionsOrVm : new EthVM(optionsOrVm);
    this.trie = this.ethVm.trie;
    this.sandbox = sandbox;
    this.withDebug = withDebug;
    this.debugger = null;
    this.hashDict = hashDict ? hashDict : [];

    if (this.withDebug) {
      this.ethVm.on('step', function(data, cb) {
        if (data.opcode.name == 'SHA3') {
          var offsetBuf = data.stack[data.stack.length - 1];
          var offset = offsetBuf.readUIntBE(0, offsetBuf.length) || 0;
          var lengthBuf = data.stack[data.stack.length - 2];
          var length = lengthBuf.readUIntBE(0, lengthBuf.length) || 0;
          var src = new Buffer(data.memory.slice(offset, offset + length));
          self.hashDict.push({
            src: src,
            hash: util.sha3(src, 'binary')
          });
        }
        cb();
      });

      this.debugger = Object.create(Debugger).init(
        this.ethVm, 
        this.sandbox, 
        this.hashDict
      );
    }

    return this;
  },

  copy: function() {

    // copy hash dictionary
    var hashDict = this.hashDict.slice();

    var cp = Object.create(VM).init(
      this.ethVm.copy(),
      this.sandbox, 
      this.withDebug,
      hashDict
    );

    if (this.debugger) {
      // copy tracer
      cp.debugger.tracer = this.debugger.tracer.copy();
    }

    return cp;
  },

  destroy: function() {
    
    if (this.debugger) {
      this.debugger.destroy();
    }
    this.debugger = null;

    this.ethVm = null;
    this.trie = null;
    this.hashDict = null;
    this.withDebug = null;
  },

  runCode: function(options, cb) {

    var self = this;

    if (this.debugger) {
      this.debugger.setCallData(options.code);
    }

    return this.ethVm.runCode(options, function(err, result) {
      
      if (self.debugger) {
        self.debugger.finish();
      }

      if (cb) {
        cb(err, result);
      }

    });
  },

  runBlock: function(options, cb) {
    return this.ethVm.runBlock(options, cb);
  },

  runTx: function(options, cb) {
    return this.ethVm.runTx(options, cb);
  },

  // debugger calls

  resume: function() {
    if (this.debugger) { 
      this.debugger.resume();
    }
  },

  stepInto: function() {
    if (this.debugger) { 
      this.debugger.stepInto();
    }
  },

  stepOver: function() {
    if (this.debugger) {
      this.debugger.stepOver();
    }
  },

  stepOut: function() {
    if (this.debugger) { 
      this.debugger.stepOut();
    }
  }

};

module.exports = VM;
