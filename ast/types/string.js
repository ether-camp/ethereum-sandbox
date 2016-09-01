var DynamicType = require('./dynamic_type');

var StringType = Object.create(DynamicType);

StringType.matchType = function(name) {
  return name == 'string';
};

StringType.appendValue = function(prev, data) {
  if (!prev) prev = '';
  return prev + this.parseValue(data);
};

StringType.parseValue = function(buf) {
  return buf.toString('utf8');
};

module.exports = StringType;

