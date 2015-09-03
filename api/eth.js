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
    getTransactionCount: function(address, block, cb) {
      cb(null, util.toHex(_(sandbox.receipts).where({from: address}).size()));
    },
    getBlockTransactionCountByHash: function(block, cb) {
      cb(null, util.toHex(_(sandbox.receipts).where({blockHash: block}).size()));
    },
    getBlockTransactionCountByNumber: function(block, cb) {
      if (block === 'earliest') send(new BigNumber(0));
      else if (block === 'latest')
        sandbox.blockchain.getHead(function(err, lastBlock) {
          if (err) util.jsonRpcCallback(cb)(err);
          else send(util.toBigNumber(lastBlock.header.number));
        });
      else if (block === 'pending') cb(null, '0x0');
      else send(util.toBigNumber(block));

      function send(number) {
        cb(null, util.toHex(_(sandbox.receipts).filter(function(receipt) {
          return receipt.blockNumber.equals(number);
        }).size()));
      }
    },
    getUncleCountByBlockHash: function(block, cb) { cb(null, '0x0'); },
    getUncleCountByBlockNumber: function(block, cb) { cb(null, '0x0'); },
    getCode: function(address, block, cb) {
      cb = util.jsonRpcCallback(cb);
      sandbox.getAccount(address.substr(2), function(err, account) {
        if (err) cb(err);
        else cb(null, '0x' + account.code);
      });
    },
    sendTransaction: function(options, cb) {
      if (options.hasOwnProperty('gas')) {
        options.gasLimit = options.gas;
        delete options.gas;
      }
      sandbox.sendTx(util.toBigNumbers(options), util.jsonRpcCallback(cb));
    },
    call: function(options, block, cb) {
      cb = util.jsonRpcCallback(cb);
      if (options.hasOwnProperty('gas')) {
        options.gasLimit = options.gas;
        delete options.gas;
      }
      sandbox.call(util.toBigNumbers(options), function(err, result) {
        if (err) cb(err)
        else cb(
          null,
          result.vm.hasOwnProperty('return') ? util.toHex(util.toBigNumber(result.vm.return)) : '0x0'
        );
      });
    },
    estimateGas: function(options, block, cb) {
      cb = util.jsonRpcCallback(cb);
      if (options.hasOwnProperty('gas')) {
        options.gasLimit = options.gas;
        delete options.gas;
      }
      sandbox.call(util.toBigNumbers(options), function(err, result) {
        cb(err, result ? util.toHex(util.toBigNumber(result.gasUsed)) : null);
      });
    },
    getTransactionReceipt: function(hash, cb) {
      if (sandbox.receipts.hasOwnProperty(hash)) {
        var receipt = sandbox.receipts[hash];
        cb(null, {
          transactionHash: receipt.transactionHash,
          transactionIndex: receipt.transactionIndex,
          blockNumber: util.toHex(receipt.blockNumber),
          blockHash: receipt.blockHash,
          cumulativeGasUsed: receipt.cumulativeGasUsed,
          gasUsed: receipt.gasUsed,
          contractAddress: receipt.contractAddress,
          logs: receipt.logs
        });
      } else cb(null, null);
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
