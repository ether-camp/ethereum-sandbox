var _ = require('lodash');
var util = require('../util');
var BN = require('bignumber.js');
var UintType = require('./types/uint');
var IntType = require('./types/int');
var BoolType = require('./types/bool');
var AddressType = require('./types/address');
var BytesNType = require('./types/bytesN');
var StringType = require('./types/string');
var BytesType = require('./types/bytes');
var StaticArrayType = require('./types/static_array');
var DynamicArrayType = require('./types/dynamic_array');
var MappingType = require('./types/mapping');

var types = [
  UintType, IntType, BoolType, AddressType, BytesNType,
  StringType, BytesType,
  StaticArrayType, DynamicArrayType,
  MappingType
];

var Creator = {
  types: [],
  init: function(userDefinedTypes) {
    this.types = types.concat(userDefinedTypes);
    return this;
  },
  create: function(node, contract) {
    var type = _.find(this.types, function(type) { return type.is(node, contract); });
    return type ? Object.create(type).init(node, this, contract) : null;
  }
};

module.exports = Creator;
