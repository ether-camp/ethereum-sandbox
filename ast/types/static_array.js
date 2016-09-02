var _ = require('lodash');
var async = require('async');
var UintType = require('./uint');
var util = require('../../util');

var StaticArrayType = {
  is: function(node) {
    return node.name == 'ArrayTypeName' &&
      node.children.length >= 2 &&
      node.children[1].name == 'Literal' &&
      _.startsWith(node.children[1].attributes.type, 'int_const');
  },
  init: function(node, typeCreator, contract) {
    this.size = parseInt(node.children[1].attributes.value);
    this.internal = typeCreator.create(node.children[0], contract);
    this.type = this.internal.type + '[' + this.size + ']';
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
  }
};

module.exports = StaticArrayType;
