var _ = require('lodash');
var async = require('async');
var UintType = require('./uint');
var util = require('../../util');

var StaticArrayType = {
  is: function(typeName) {
    return /\[\d+\] [\w ]+$/.test(typeName);
  },
  init: function(typeName, typeCreator, contract) {
    this.type = typeName;
    var parts = /^(.*)\[(\d+)\] ([\w ]+)$/.exec(typeName);
    this.size = parseInt(parts[2]);
    this.storageType = parts[3];
    var internalTypeName = parts[1];
    this.internal = typeCreator.create(internalTypeName, contract);
    return this;
  },
  retrieve: function(storage, hashDict, position) {
    var self = this;
    
    if (position.offset > 0) {
      util.inc(position.index);
      position.offset = 0;
    }

    return _.times(this.size, function() {
      return self.internal.retrieve(storage, hashDict, position);
    });
  },
  retrieveStack: function(stack, memory, index) {
    var self = this;
    var offset = stack[index].readUIntBE(0, stack[index].length);
    return _.times(this.size, function(i) {
      return self.internal.retrieveStack(
        [ Buffer.from(memory.slice(offset + i * 32, offset + i * 32 + 32)) ],
        memory,
        0
      );
    });
  },
  retrieveData: function(stack, calldata, position) {
    var self = this;
    var offset = stack[position.index].readUIntBE(0, stack[position.index].length);
    position.index++;
    return _.times(this.size, function(i) {
      return self.internal.retrieveStack(
        [ Buffer.from(calldata.slice(offset + i * 32, offset + i * 32 + 32)) ],
        calldata,
        0
      );
    });
  }
};

module.exports = StaticArrayType;
