var _ = require('lodash');
var util = require('../../util');

var ElementaryType = {
  is: function(typeName) {
    return this.matchType(typeName);
  },
  init: function(typeName) {
    this.type = typeName;
    this.size = this.getSize(this.type);
    this.stackSize = 1;
    this.storageType = 'memory'; // for func scope
    return this;
  },
  retrieve: function(storage, hashDict, position) {
    if (32 - position.offset < this.size) {
      util.inc(position.index);
      position.offset = 0;
    }

    var entry = _.find(storage, function(entry) {
      return entry.key.equals(position.index);
    });

    var value;
    if (entry) {
      var data = util.decodeRlp(entry.value);
      if (data.length >= position.offset) {
        var from = data.length - position.offset - this.size;
        value = data.slice(from > 0 ? from : 0, data.length - position.offset);
      }
    }
    
    if (this.size + position.offset >= 32) {
      util.inc(position.index);
      position.offset = 0;
    } else {
      position.offset += this.size;
    }
    
    return this.parseValue(value);
  },
  retrieveStack: function(stack, memory, index) {
    return this.parseValue(stack[index]);
  }
};

module.exports = ElementaryType;
