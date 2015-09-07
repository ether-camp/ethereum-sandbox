var _ = require('lodash');
var util = require('../util');

module.exports = function(sandbox) {
  return {
    id: function(cb) {
      cb(null, sandbox.id);
    },
    createAccounts: function(accounts, cb) {
      sandbox.createAccounts(accounts, util.jsonRpcCallback(cb));
    },
    setBlock: function(block, cb) {
      sandbox.setBlock(util.toBigNumbers(block));
      cb(null, null);
    },
    defaultAccount: function(cb) {
      cb(null, sandbox.defaultAccount);
    },
    predefinedAccounts: function(cb) {
      cb(null, _.transform(sandbox.accounts, function(result, pkey, address) {
        result[address.substr(2)] = pkey ? pkey.toString('hex') : null;
      }));
    },
    accounts: function(full, cb) {
      if (full) sandbox.getAccounts(util.jsonRpcCallback(cb));
      else sandbox.getAccountAddresses(util.jsonRpcCallback(cb));
    },
    transactions: function(cb) {
      cb(null, sandbox.transactions);
    },
    contracts: function(cb) {
      cb(null, sandbox.contracts);
    }
  };
};
