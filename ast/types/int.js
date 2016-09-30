var _ = require('lodash');
var BN = require('bignumber.js');
var ElementaryType = require('./elementary-type');

var IntType = Object.create(ElementaryType);

IntType.matchType = function(type) {
  return _.startsWith(type, 'int');
};

IntType.getSize = function(type) {
  var size = type.substr(3);
  return size.length > 0 ? parseInt(size) / 8 : 32;
};

IntType.parseValue = function(buf) {
  var hex = buf && buf.length > 0 ? buf.toString('hex') : '0';
  return parseInt(hex, this.size).toString();

  function parseInt(hex, size) {
    var val = new BN(hex, 16);
    if (isNegative(val, size)) {
      val = val.minus(new BN(_.repeat('ff', size), 16)).minus(1);
    }
    return val;
  }
  function isNegative(val, size) {
    return val.gte(new BN(2).pow(size * 8 - 1));
  }
};

module.exports = IntType;
