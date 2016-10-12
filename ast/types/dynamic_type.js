var _ = require('lodash');
var async = require('async');
var util = require('../../util');

var DynamicType = {
  name: null,
  type: null,
  size: null,
  
  is: function(node) {
    return node.name == 'ElementaryTypeName' && this.matchType(node.attributes.name);
  },
  init: function(node) {
    this.type = node.attributes.name;
    return this;
  },
  retrieve: function(storage, hashDict, position) {
    if (position.offset > 0) {
      util.inc(position.index);
      position.offset = 0;
    }

    var entry = _.find(storage, function(entry) {
      return entry.key.equals(position.index);
    });

    var value = '';
    if (entry) {
      var data = util.decodeRlp(entry.value);
      var short = (data[data.length - 1] % 2 == 0);
      if (short) {
        var len = data[data.length - 1] / 2;
        value = this.parseValue(data.slice(0, len));
      } else {
        len = (data.readUIntBE(0, data.length) - 1) / 2;
        var hash = util.sha3(position.index, 'binary');
        while (len > 0) {
          entry = _.find(storage, function(entry) {
            return entry.key.equals(hash);
          });
          
          data = entry ?
            util.decodeRlp(entry.value) :
            new Buffer(len > 32 ? 32 : len).fill(0);

          value = this.appendValue(value, data.slice(0, len));
              
          len -= 32;
          util.inc(hash);
        }
      }
    }
    util.inc(position.index);
    return value;
  },
  retrieveStack: function(stack, index) {
    return '[not implemented]';
  }
};

module.exports = DynamicType;
