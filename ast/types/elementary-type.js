var _ = require('lodash');
var util = require('../../util');

var ElementaryType = {
  name: null,
  type: null,
  size: null,
  
  is: function(node) {
    return node.name == 'ElementaryTypeName' && this.matchType(node.attributes.name);
  },
  init: function(node) {
    this.type = node.attributes.name;
    this.size = this.getSize(this.type);
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
  retrieveStack: function(stack, index) {
    return this.parseValue(stack[2 + index]);
  }
};

module.exports = ElementaryType;
