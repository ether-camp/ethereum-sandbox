var DynamicType = require('./dynamic_type');

var BytesType = Object.create(DynamicType);

BytesType.matchType = function(typeName) {
  return /^bytes [\w ]+$/.test(typeName);
};

BytesType.appendValue = function(prev, data) {
  if (!prev) prev = '0x';
  return prev + data.toString('hex');
};

BytesType.parseValue = function(buf) {
  return buf && buf.length > 0 ? '0x' + buf.toString('hex') : '';
};

module.exports = BytesType;
