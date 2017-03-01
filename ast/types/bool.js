var BN = require('bignumber.js');
var ElementaryType = require('./elementary-type');

var BoolType = Object.create(ElementaryType);

BoolType.matchType = function(type) {
  return type == 'bool';
};

BoolType.getSize = function(type) {
  return 1;
};

BoolType.parseValue = function(buf) {
  return buf && buf.length > 0 ? (buf[buf.length - 1] != 0).toString() : 'false';
};

module.exports = BoolType;
