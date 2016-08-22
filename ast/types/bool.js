var BN = require('bignumber.js');
var ElementaryType = require('./elementary-type');

var BoolType = Object.create(ElementaryType);

BoolType.matchType = function(type) {
  return type == 'bool';
};

BoolType.getSize = function(type) {
  return 1;
};

BoolType.parseValue = function(value) {
  return (!(new BN(value, 16).isZero())).toString();
};

module.exports = BoolType;
