var AddressType = require('./address');

var ContractType = Object.create(AddressType);

ContractType.create = function(contract) {
  this.contract = contract;
  return this;
};

ContractType.is = function(typeName, contract) {
  return typeName == 'contract ' + this.contract;
};

module.exports = ContractType;
