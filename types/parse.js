var _ = require('lodash');
var BigNumber = require('bignumber.js');

var types = {
  address: function(val, errors) {
    if (typeof val !== 'string' || !val.match(/^0x[\dabcdef]{40}$/))
      errors.push('Address must contain 0x and 40 hex digits;');
    return val;
  },
  number: function(val, errors) {
    if (typeof val !== 'string' || !val.match(/^0x[\dabcdef]+$/))
      errors.push('Number must contain 0x and at least one hex digit;');
    return new BigNumber(val.substr(2), 16);
  },
  hex: function(val, errors) {
    if (typeof val !== 'string' || !val.match(/^0x[\dabcdef]+$/))
      errors.push('Hex number must contain 0x and at least one hex digit;');
    return val;
  },
  contract: function(val, errors) {
    if (typeof val !== 'object' ||
        !val.hasOwnProperty('name') ||
        !val.hasOwnProperty('binary') ||
        !val.hasOwnProperty('abi'))
      errors.push('Contract must be an object with properties name, binary, abi;');
    return val;
  }
};

function parse(values, valTypes, errors) {
  return _.transform(valTypes, function(result, details, name) {
    if (values.hasOwnProperty(name)) {
      var errs = []
      result[name] = types[details.type](values[name], errs);
      errors = _.union(errors, _.map(errs, function(err) { return name + ': ' + err; }));
    } else {
      if (details.hasOwnProperty('defaultVal')) result[name] = details.defaultVal;
      else errors.push('Argument ' + name + ' is required;');
    }
  });
}

parse.types = types;
module.exports = parse;
