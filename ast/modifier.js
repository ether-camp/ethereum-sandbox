var _ = require('lodash');
var Method = require('./method');

var Modifier = Object.create(Method);

Modifier.init = function(node, typeCreator, contract, source) {
  Method.init.call(this, 'modifier', node, typeCreator, contract, source);
  return this;
};

module.exports = Modifier;
