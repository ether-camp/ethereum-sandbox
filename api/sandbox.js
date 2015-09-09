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
      var errors = [];
      options = parse(options, {
        coinbase: { type: 'address', defaultVal: null },
        difficulty: { type: 'number', defaultVal: null },
        gasLimit: { type: 'number', defaultVal: null }
      }, errors);
      if (errors.length !== 0) return cb(errors.join(' '), null);
      if (options.coinbase) sandbox.coinbase = options.coinbase;
      if (options.difficulty) sandbox.difficulty = options.difficulty;
      if (options.gasLimit) sandbox.gasLimit = options.gasLimit;
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
      cb(null, _.invoke(sandbox.receipts, 'getDetails'));
    },
    receipt: function(txHash, cb) {
      cb(null, sandbox.receipts.hasOwnProperty(txHash) ?
         sandbox.receipts[txHash].getDetails() : null);
    },
    contracts: function(cb) {
      cb(null, sandbox.contracts);
    }
  };
};
