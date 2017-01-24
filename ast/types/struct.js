var _ = require('lodash');
var util = require('../../util');

var StructType = {
  create: function(node, contract) {
    this.contract = contract;
    this.type = contract + '.' + node.attributes.name;
    this.fieldNodes = node.children;
    return this;
  },
  is: function(typeName, contract) {
    return _.startsWith(typeName, 'struct ' + this.type + ' ');
  },
  init: function(typeName, typeCreator, contract) {
    var self = this;
    this.storageType = typeName.substr(this.type.length + 8);
    this.fields = _.map(this.fieldNodes, function(node) {
      var typeHandler = typeCreator.create(node.attributes.type, self.contract);
      typeHandler.name = node.attributes.name;
      return typeHandler;
    });
    return this;
  },
  retrieve: function(storage, hashDict, position) {
    if (position.offset > 0) {
      util.inc(position.index);
      position.offset = 0;
    }

    return _(this.fields)
      .map(function(field) {
        return [
          field.name,
          field.retrieve(storage, hashDict, position)
        ];
      })
      .object()
      .value();
  },
  retrieveStack: function(stack, memory, index) {
    var offset = stack[index].readUIntBE(0, stack[index].length);
    return _(this.fields)
      .map(function(field, i) {
        return [
          field.name,
          field.retrieveStack(
            [ Buffer.from(memory.slice(offset + i * 32, offset + i * 32 + 32)) ],
            memory,
            0
          )
        ];
      })
      .object()
      .value();
  }
};

module.exports = StructType;
