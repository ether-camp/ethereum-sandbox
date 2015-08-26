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
    predefinedAccounts: function(cb) {
      cb(null, _.transform(sandbox.accounts, function(result, pkey, address) {
        result[address] = pkey ? pkey.toString('hex') : null;
      }));
    },
    accounts: function(cb) {
      sandbox.getAccounts(util.jsonRpcCallback(cb));
    },
    runTx: function(options, cb) {
      sandbox.runTx(options, util.jsonRpcCallback(cb));
    },
    transactions: function(cb) {
      cb(null, sandbox.transactions);
    },
    contracts: function(cb) {
      cb(null, sandbox.contracts);
    }
  };
};
