var ElementaryType = require('./elementary-type');
var util = require('../../util');

var AddressType = Object.create(ElementaryType);

AddressType.matchType = function(type) {
  return type == 'address';
};

AddressType.getSize = function(type) {
  return 20;
};

AddressType.parseValue = function(value) {
  return '0x' + util.fillWithZeroes(value, 40);
};

module.exports = AddressType;
