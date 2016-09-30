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

AddressType.parseValue = function(buf) {
  if (buf && buf.length > 20) buf = buf.slice(buf.length - 20);
  return buf && buf.length > 0 ?
    '0x' + util.fillWithZeroes(buf.toString('hex'), 40) : emptyAddress;
};

module.exports = AddressType;
