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
    strOrBuf = new Buffer(util.pad(util.fromHex(strOrBuf)), 'hex');
  sha.update(strOrBuf);
  var out = sha.digest(encoding);
  return Buffer.isBuffer(out) ? out : util.toHex(out);
};

util.fromHex = function(str) {
  if (str.substr(0, 2) === '0x') return str.substr(2);
  return str;
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

util.toBuffers = function(obj, fields) {
  return _.transform(obj, function(result, val, key) {
    if (_.isString(val) && (!fields || _.contains(fields, key)))
      result[key] = new Buffer(util.pad(util.fromHex(val)), 'hex');
    else
      result[key] = val;
  });
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

util.toBigNumbers = function(obj) {
  return _.transform(obj, function(result, val, key) {
    result[key] = util.toBigNumber(val);
  });
};
    
util.toBuffer = function(number) {
  if (util.isBigNumber(number)) return new Buffer(util.pad(number.toString(16)), 'hex');
  if (number.indexOf('0x') != -1) return new Buffer(util.pad(number.substr(2)), 'hex');
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
  return crypto.createHash('sha1').update(now + seed).digest('hex');
};

util.fillWithZeroes = function(str, length, right) {
  if (str.length >= length) return str;
  var zeroes = _.repeat('0', length - str.length);
  return right ? str + zeroes : zeroes + str;
};

util.nowHex = function() {
  return util.pad(Math.floor(Date.now() / 1000).toString(16));
};

util.toNumber = function(obj) {
  if (Buffer.isBuffer(obj)) return ethUtils.bufferToInt(obj);
  if (typeof obj === 'string' && _.startsWith(obj, '0x')) return parseInt(obj, 16);
  return obj;
};

util.encodeRlp = function(buf) {
  return rlp.encode(buf);
}

util.decodeRlp = function(buf) {
  return rlp.decode(buf);
}

module.exports = util;
