var _ = require('lodash');
var async = require('async');
var util = require('../../util');

var DynamicArrayType = {
  is: function(node) {
    return node.name == 'ArrayTypeName' && node.children.length == 1;
  },
  init: function(node, typeCreator, contract) {
    this.internal = typeCreator.create(node.children[0], contract);
    this.type = this.internal.type + '[]';
    return this;
  },
  retrieve: function(storage, hashDict, position) {
    var self = this;
    
    if (position.offset > 0) {
      util.inc(position.index);
      position.offset = 0;
    }

    var entry = _.find(storage, function(entry) {
      return entry.key.equals(position.index);
    });

    var value = [];
    if (entry) {
      var data = util.decodeRlp(entry.value);
      var len = (data.readUIntBE(0, data.length));
      var internalPosition = {
        index: util.sha3(position.index, 'binary'),
        offset: 0
      };

      value = _.times(len, function() {
        return self.internal.retrieve(storage, hashDict, internalPosition);
      });
    }
    
    util.inc(position.index);
    return value;
  }
};

module.exports = DynamicArrayType;
