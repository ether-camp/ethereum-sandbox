var _ = require('lodash');
var ElementaryType = require('./elementary-type');
var util = require('../../util');

var emptyAddress = '0x' + _.repeat(40, '0');

var AddressType = Object.create(ElementaryType);

AddressType.matchType = function(type) {
  return type == 'address';
};

AddressType.getSize = function(type) {
  return 20;
};

AddressType.parseValue = function(buff) {
  return buff ? '0x' + util.fillWithZeroes(buff.toString('hex'), 40) : emptyAddress;
};

module.exports = AddressType;
