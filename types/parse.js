var _ = require('lodash');
var BigNumber = require('bignumber.js');

var types = {
  address: function(val, errors) {
    if (typeof val !== 'string' || !val.match(/^0x[\dabcdef]{40}$/))
      errors.push('Address must contain 0x and 40 hex digits;');
    return val;
  },
  number: function(val, errors) {
    if (typeof val !== 'string' || !val.match(/^0x[\dabcdef]+$/)) {
      errors.push('Number must contain 0x and at least one hex digit;');
      return null;
    } else {
      return new BigNumber(val.substr(2), 16);
    }
  },
  hex: function(val, errors) {
    if (typeof val !== 'string' || !val.match(/^0x[\dabcdef]+$/))
      errors.push('Hex number must contain 0x and at least one hex digit;');
    return val;
  },
  hex64: function(val, errors) {
    if (typeof val !== 'string' || !val.match(/^0x[\dabcdef]{64}$/))
      errors.push('Hex number must contain 0x and 64 hex digits;');
    return val;
  },
  contract: function(val, errors) {
    if (typeof val !== 'object' ||
        !val.hasOwnProperty('name') ||
        !val.hasOwnProperty('binary') ||
        !val.hasOwnProperty('abi'))
      errors.push('Contract must be an object with properties name, binary, abi;');
    return val;
  },
  bool: function(val, errors) {
    if (typeof val !== 'boolean') errors.push('Not a boolean');
    return val;
  },
  block: function(val, errors) {
    if (val == 'latest' || val == 'earliest' || val == 'pending') return val;
    else return types.number(val, errors);
  },
  string: function(val, errors) {
    if (typeof val !== 'string') errors.push('Must be a string');
    return val;
  }
};

function parse(value, type, errors, elName) {
  if (!elName) elName = 'root'
  var result = null;
  if (value == null || value == undefined) {
    if (type.hasOwnProperty('defaultVal')) result = type.defaultVal;
    else errors.push('Argument ' + elName + ' is required;');
  } else if (type.type === 'map') {
    if (!_.isPlainObject(value)) errors.push(elName + ' must be an object;');
    else if (type.hasOwnProperty('key')) {
      result = _.transform(value, function(result, val, name) {
        var parsedName = parse(name, { type: type.key }, errors, 'key of ' + elName)
        result[parsedName] = parse(val, type.values, errors, name);
      });
    } else {
      result = _.transform(type.values, function(result, type, name) {
        result[name] = parse(value[name], type, errors, name);
      });
    }
  } else {
    var errs = [];
    result = types[type.type](value, errs);
    if (errs.length !== 0)
      errors.push.apply(errors, _.map(errs, function(err) {
        return elName + ': ' + err;
      }));
  }
  return result;
}

parse.types = types;
module.exports = parse;
