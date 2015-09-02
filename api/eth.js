var util = require('../util');
var _ = require('lodash');
var BigNumber = require('bignumber.js');

module.exports = function(sandbox) {
  return {
    protocolVersion: function(cb) {
      cb(null, '54');
    },
    coinbase: function(cb) {
      cb(null, util.toHex(sandbox.coinbase.toString('hex')));
    },
    mining: function(cb) {
      cb(null, false);
    },
    hashrate: function(cb) {
      cb(null, '0x0');
    },
    gasPrice: function(cb) {
      cb(null, '0x0');
    },
    accounts: function(cb) {
      cb(null, _.keys(sandbox.accounts));
    },
    blockNumber: function(cb) {
      sandbox.blockchain.getHead(function(err, block) {
        cb(null, block ? util.toHex(block.header.number.toString('hex')) : null);
      });
    },
    getBalance: function(address, block, cb) {
      cb = util.jsonRpcCallback(cb);
      sandbox.getAccount(address.substr(2), function(err, account) {
        if (err) cb(err);
        else cb(null, '0x' + account.balance);
      });
    },
    getStorageAt: function(address, position, block, cb) {
      cb = util.jsonRpcCallback(cb);
      position = util.fillWithZeroes(position.substr(2), 64);
      sandbox.getAccount(address.substr(2), function(err, account) {
        if (err) cb(err);
        else if (account.storage.hasOwnProperty(position)) {
          var value = new BigNumber(account.storage[position], 16);
          cb(null, '0x' + value.toString(16));
        } else cb(null, null);
      });
    },
    sendTransaction: function(options, cb) {
      options.gasLimit = options.gas;
      delete options.gas;
      sandbox.sendTx(util.toBigNumbers(options), util.jsonRpcCallback(cb));
    },
    getTransactionReceipt: function(hash, cb) {
      if (sandbox.receipts.hasOwnProperty(hash)) cb(null, sandbox.receipts[hash]);
      else cb(null, null);
    },
    newFilter: function(options, cb) {
      sandbox.newFilter(options, util.jsonRpcCallback(cb));
    },
    newPendingTransactionFilter: function(cb) {
      sandbox.newFilter('pending', util.jsonRpcCallback(cb));
    },
    uninstallFilter: function(filterId, cb) {
      sandbox.removeFilter(filterId, util.jsonRpcCallback(cb));
    },
    getFilterChanges: function(filterId, cb) {
      sandbox.getFilterChanges(filterId, util.jsonRpcCallback(cb));
    },
    getFilterLogs: function(filterId, cb) {
      sandbox.getFilterChanges(filterId, util.jsonRpcCallback(cb));
    }
  };
};
