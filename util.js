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
 
var BigNumber = require('bignumber.js');
var _ = require('lodash');
var SHA3Hash = require('sha3').SHA3Hash;
var crypto = require('crypto');
var ethUtils = require('ethereumjs-util');
var rlp = require('rlp');

var util = {};

util.SHA3_RLP_NULL = '56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421';

util.sha3 = function(strOrBuf, encoding) {
  var sha = new SHA3Hash(256);
  if (!Buffer.isBuffer(strOrBuf))
    strOrBuf = new Buffer(util.pad(strOrBuf.substr(2)), 'hex');
  sha.update(strOrBuf);
  var out = sha.digest(encoding);
  return Buffer.isBuffer(out) ? out : util.toHex(out);
};

util.toHex = function(obj, toLength) {
  var val = obj;
  if (typeof obj === 'number') val = obj.toString(16);
  if (util.isBigNumber(obj)) val = obj.toString(16);
  if (Buffer.isBuffer(obj)) val = (obj.toString('hex') || '0');
  return '0x' + (toLength ? util.fillWithZeroes(val, toLength) : val);
};

util.pad = function(str) {
  return str.length % 2 === 0 ? str : '0' + str;
};

util.isBigNumber = function(object) {
  return object instanceof BigNumber ||
    (object && object.constructor && object.constructor.name === 'BigNumber');
};

util.toBigNumber = function(number) {
  number = number || 0;
  if (util.isBigNumber(number)) return number;

  if (_.isString(number) && (_.startsWith(number, '0x') || _.startsWith(number, '-0x'))) {
    return new BigNumber(number.replace('0x',''), 16);
  }

  if (_.isString(number)) return new BigNumber(number, 16);

  if (Buffer.isBuffer(number)) {
    return number.length === 0 ?
      new BigNumber(0) :
      new BigNumber(number.toString('hex'), 16);
  }

  return new BigNumber(number.toString(10), 10);
};

util.toBuffer = function(number, toLength) {
  if (util.isBigNumber(number)) {
    if (toLength) return new Buffer(util.fillWithZeroes(number.toString(16), toLength), 'hex');
    else return new Buffer(util.pad(number.toString(16)), 'hex');
  }
  if (number.indexOf('0x') != -1) {
    if (toLength) return new Buffer(util.fillWithZeroes(number.substr(2), toLength), 'hex');
    else return new Buffer(util.pad(number.substr(2)), 'hex');
  }
  return new Buffer(number, 'hex');
};

util.jsonRpcCallback = function(cb) {
  return function(err, reply) {
    if (err) err = { code: 0, message: err };
    if (reply === undefined) reply = null;
    cb(err, reply);
  };
};

util.generateId = function() {
  var now = (new Date()).valueOf().toString();
  var seed = Math.random().toString();
  return crypto.createHash('sha1').update(now + seed).digest('hex').substr(0, 10);
};

util.fillWithZeroes = function(str, length, right) {
  if (str.length >= length) return str;
  var zeroes = _.repeat('0', length - str.length);
  return right ? str + zeroes : zeroes + str;
};

util.nowHex = function(offset) {
  if (!offset) offset = 0;
  return util.pad(Math.floor(Date.now() / 1000 + offset).toString(16));
};

util.toNumber = function(obj) {
  if (Buffer.isBuffer(obj)) return ethUtils.bufferToInt(obj);
  if (typeof obj === 'string' && _.startsWith(obj, '0x')) return parseInt(obj, 16);
  return obj;
};

util.encodeRlp = function(buf) {
  return rlp.encode(buf);
};

util.decodeRlp = function(buf) {
  return rlp.decode(buf);
};

util.synchronize = function(fn) {
  return function() {
    if (this._lock) {
      if (!this._deferredCalls) this._deferredCalls = [];
      this._deferredCalls.push({
        fn: fn,
        args: arguments
      });
    } else call(this, fn, arguments);

    function call(obj, fn, args) {
      obj._lock = true;
      var cb = args[args.length - 1];
      if (!_.isFunction(cb))
        throw 'the last arg of synchronized function has to be a callback';
      args[args.length - 1] = function() {
        if (!obj._deferredCalls) obj._deferredCalls = [];
        if (obj._deferredCalls.length > 0) {
          var params = obj._deferredCalls.shift();
          call(obj, params.fn, params.args);
        } else {
          obj._lock = false;
        }
        cb.apply(null, arguments);
      };
      fn.apply(obj, args);
    }
  };
};

util.showError = function(err) {
  if (err) console.error(err);
};

module.exports = util;
