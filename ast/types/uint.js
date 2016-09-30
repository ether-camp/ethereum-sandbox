var _ = require('lodash');
var BN = require('bignumber.js');
var ElementaryType = require('./elementary-type');

var UintType = Object.create(ElementaryType);

UintType.matchType = function(type) {
  return _.startsWith(type, 'uint');
};

UintType.getSize = function(type) {
  var size = type.substr(4);
  return size.length > 0 ? parseInt(size) / 8 : 32;
};

UintType.parseValue = function(buf) {
  return buf && buf.length > 0 ? new BN(buf.toString('hex'), 16).toString() : '0';
};

module.exports = UintType;
