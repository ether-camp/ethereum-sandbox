var _ = require('lodash');
var util = require('../../util');

var EnumType = {
  create: function(node, contract) {
    this.type = contract + '.' + node.attributes.name;
    this.values = _.map(node.children, function(node) {
      return node.attributes.name;
    });
    return this;
  },
  is: function(typeName, contract) {
    return typeName == 'enum ' + this.type;
  },
  init: function(node, typeCreator, contract) {
    this.storageType = 'memory';
    return this;
  },
  retrieve: function(storage, hashDict, position) {
    if (position.offset == 32) {
      util.inc(position.index);
      position.offset = 0;
    }

    var entry = _.find(storage, function(entry) {
      return entry.key.equals(position.index);
    });

    var value;
    if (entry) {
      var data = util.decodeRlp(entry.value);
      if (data.length > position.offset) {
        value = data.slice(data.length - position.offset - 1, data.length - position.offset);
      }
    }

    if (position.offset == 31) {
      util.inc(position.index);
      position.offset = 0;
    } else {
      position.offset++;
    }

    return this.parseValue(value);
  },
  retrieveStack: function(stack, index) {
    return this.parseValue(stack[index]);
  },
  parseValue: function(buf) {
    return this.values[buf && buf.length > 0 ? buf[0] : 0];
  }
};

module.exports = EnumType;
