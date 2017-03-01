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
    this.stackSize = 1;
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
    var idx = 0;
    return _(this.fields)
      .map(function(field) {
        var value;
        if (_.startsWith(field.type, 'mapping(')) value = 'No value';
        else {
          value = field.retrieveStack(
            [ Buffer.from(memory.slice(offset + idx * 32, offset + idx * 32 + 32)) ],
            memory,
            0
          );
          idx++;
        }
        return [ field.name, value ];
      })
      .object()
      .value();
  }
};

module.exports = StructType;
