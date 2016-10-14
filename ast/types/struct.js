var _ = require('lodash');
var util = require('../../util');

var StructType = {
  create: function(node, contract) {
    this.contract = contract;
    this.type = contract + '.' + node.attributes.name;
    this.fieldNodes = node.children;
    return this;
  },
  is: function(node, contract) {
    if (node.name != 'UserDefinedTypeName') return false;
    var name = node.attributes.name;
    if (name.indexOf('.') == -1) name = contract + '.' + name;
    return name == this.type;
  },
  init: function(node, typeCreator, contract) {
    var self = this;
    this.fields = _.map(this.fieldNodes, function(node) {
      var typeHandler = typeCreator.create(node.children[0], self.contract);
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
      .map(function(field) {
        var value = [
          field.name,
          field.retrieveStack(
            [ Buffer.from(memory.slice(offset, offset + 32)) ],
            memory,
            0
          )
        ];
        offset += 32;
        return value;
      })
      .object()
      .value();
  }
};

module.exports = StructType;
