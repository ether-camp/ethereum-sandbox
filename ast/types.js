var _ = require('lodash');
var util = require('../util');
var BN = require('bignumber.js');
var UintType = require('./types/uint');
var IntType = require('./types/int');
var BoolType = require('./types/bool');
var AddressType = require('./types/address');
var BytesNType = require('./types/bytesN');

var types = [ UintType, IntType, BoolType, AddressType, BytesNType ];

function create(node) {
  var type = _.find(types, function(type) { return type.is(node); });
  return type ? Object.create(type).init(node) : null;
}

module.exports = create;
