var _ = require('lodash');
var ElementaryType = require('./elementary-type');
var util = require('../../util');

var BytesNType = Object.create(ElementaryType);

BytesNType.matchType = function(type) {
  return (_.startsWith(type, 'bytes') && type != 'bytes') ||
    type == 'byte';
};

BytesNType.getSize = function(type) {
  return type == 'byte' ? 1 : parseInt(type.substr(5));
};

BytesNType.parseValue = function(buf) {
  return buf ?
    '0x' + util.fillWithZeroes(buf.toString('hex'), this.size * 2) :
    '0x' + _.repeat(this.size, '00');
};

module.exports = BytesNType;
