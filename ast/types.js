var _ = require('lodash');
var util = require('../util');
var BN = require('bignumber.js');
var UintType = require('./types/uint.js');
var BoolType = require('./types/bool.js');

var types = [ UintType, BoolType ];

function create(node) {
  var type = _.find(types, function(type) { return type.is(node); });
  return type ? Object.create(type).init(node) : null;
}

function IntType(node) {
  if (node) this.parse(node);
}

IntType.is = function(node) {
  return node.children[0].name == 'ElementaryTypeName' &&
    _.startsWith(node.children[0].attributes.name, 'int');
};

IntType.prototype.parse = function(node) {
  this.name = node.attributes.name;
  this.type = node.children[0].attributes.name;
  var size = this.type.substr(3);
  this.size = size.length > 0 ? parseInt(size) / 8 : 32;
};

IntType.prototype.retrieve = function(getter, position, cb) {
  var self = this;

  if (32 - position.offset < this.size) {
    position.index++;
    position.offset = 0;
  }
  
  getter(util.toBuffer(position.index, 64), function(err, data) {
    if (err) return cb(err);

    var value = '0';
    if (data) {
      data = util.decodeRlp(data);
      value = parseInt(
        data.toString('hex', data.length - position.offset - self.size, data.length - position.offset),
        self.size
      ).toString();
    }

    if (self.size + position.offset >= 32) {
      position.index++;
      position.offset = 0;
    } else {
      position.offset += self.size;
    }

    cb(null, {
      name: self.name,
      type: self.type,
      value: value
    });
  });
  function parseInt(hex, size) {
    var val = new BN(hex, 16);
    if (isNegative(val, size)) {
      val = val.minus(new BN(_.repeat('ff', size), 16)).minus(1);
    }
    return val;
  }
  function isNegative(val, size) {
    return val.gte(new BN(2).pow(size * 8 - 1));
  }
};

module.exports = create;
