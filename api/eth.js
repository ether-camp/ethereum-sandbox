var util = require('../util');
var _ = require('lodash');

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
      cb(null, _(sandbox.accounts).keys().map(util.toHex).value());
    },
    blockNumber: function(cb) {
      if (sandbox.blockchain.head) {
        cb(null, util.toHex(sandbox.blockchain.head.header.number.toString('hex')));
      } else cb(null, null);
    },
    sendTransaction: function(options, cb) {
      sandbox.sendTx(options, util.jsonRpcCallback(cb));
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
