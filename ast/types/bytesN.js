var _ = require('lodash');
var ElementaryType = require('./elementary-type');
var util = require('../../util');

var BytesNType = Object.create(ElementaryType);

BytesNType.matchType = function(typeName) {
  return typeName == 'byte' || /^bytes\d+$/.test(typeName);
};

BytesNType.getSize = function(type) {
  return type == 'byte' ? 1 : parseInt(type.substr(5));
};

BytesNType.parseValue = function(buf) {
  if (buf && buf.length > this.size) buf = buf.slice(0, this.size);
  return buf ?
    '0x' + util.fillWithZeroes(buf.toString('hex'), this.size * 2) :
    '0x' + _.repeat(this.size, '00');
};

module.exports = BytesNType;
