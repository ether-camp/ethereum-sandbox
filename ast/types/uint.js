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

UintType.parseValue = function(value) {
  return new BN(value, 16).toString();
};

module.exports = UintType;
