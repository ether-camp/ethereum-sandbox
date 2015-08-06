var BigNumber = require('bignumber.js');
var _ = require('lodash');

var util = {};

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

module.exports = util;
