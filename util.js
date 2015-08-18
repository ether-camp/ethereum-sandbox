var BigNumber = require('bignumber.js');
var _ = require('lodash');
var SHA3Hash = require('sha3').SHA3Hash;
var crypto = require('crypto');

var util = {};

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

util.toHex = function(str) {
  return '0x' + str;
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

  return new BigNumber(number.toString(10), 10);
};

util.toBuffer = function(number) {
  return new Buffer(number.toString(16), 'hex');
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

util.collapse = function(stem, sep) {
  return function(map, value, key) {
    var prop = stem ? stem + sep + key : key;
    if(_.isFunction(value)) map[prop] = value;
    else if(_.isObject(value)) map = _.reduce(value, util.collapse(prop, sep), map);
    return map;
  };
};

module.exports = util;
