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

function create(nodeOrName) {
  var type = _.find(types, function(type) { return type.is(nodeOrName); });
  return type ? Object.create(type).init(nodeOrName) : null;
}

module.exports.create = create;
