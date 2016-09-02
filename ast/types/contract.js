var AddressType = require('./address');

var ContractType = Object.create(AddressType);

ContractType.create = function(contract) {
  this.contract = contract;
  return this;
};

ContractType.is = function(node, contract) {
  return node.name == 'UserDefinedTypeName' && node.attributes.name == this.contract;
};

module.exports = ContractType;
