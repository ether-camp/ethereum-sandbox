var util = require('../util');
var _ = require('lodash');
var BigNumber = require('bignumber.js');
var async = require('async');

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
    getBlockByHash: function(block, fullTransactions, cb) {
      cb = util.jsonRpcCallback(cb);
      sandbox.blockchain.getBlock(util.toBuffer(block), function(err, block) {
        if (err) cb(err);
        if (!block) cb(null, null);
        cb(null, {
          number: util.toHex(block.header.number),
          hash: util.toHex(block.hash()),
          parentHash: util.toHex(block.header.parentHash),
          nonce: '0x0000000000000000',
          sha3Uncles: util.toHex(block.header.uncleHash),
          logsBloom: util.toHex(block.header.bloom),
          transactionsRoot: util.toHex(block.header.transactionsTrie),
          stateRoot: util.toHex(block.header.stateRoot),
          miner: util.toHex(block.header.coinbase),
          difficulty: util.toHex(block.header.difficulty),
          // TODO: calculate total difficulty for the block
          totalDifficulty: util.toHex(block.header.difficulty), 
          extraData: util.toHex(block.header.extraData),
          size: util.toHex(block.serialize(true).length),
          gasLimit: util.toHex(block.header.gasLimit),
          minGasPrice: util.toHex(_(block.transactions).map('gasPrice').map(util.toNumber).min()),
          // TODO: Fix the bug because of which block.header.gasPrice is empty
          gasUsed: util.toHex(block.header.gasUsed),
          timestamp: util.toHex(block.header.timestamp),
          // TODO: Add support of fullTransactions=true
          transactions: _(block.transactions).invoke('hash').map(util.toHex),
          uncles: []
        });
      });
    },
    getBlockByNumber: function(blockNumber, fullTransactions, cb) {
      cb = util.jsonRpcCallback(cb);

      blockNumber = util.toNumber(blockNumber);
      if (sandbox.blockchain.meta.height < blockNumber) return cb(null, null);

      sandbox.blockchain.getHead(function(err, currBlock) {
        if (err) return cb(err);
        async.whilst(
          function() {
            return util.toNumber(currBlock.header.number) !== blockNumber;
          },
          function(cb) {
            sandbox.blockchain.getBlock(currBlock.header.parentHash, function(err, block) {
              if (err) cb(err)
              else {
                currBlock = block;
                cb()
              }
            });
          },
          function(err) {
            if (err) cb(err)
            else cb(null, details(currBlock));
          }
        );
      });
      
      function details(block) {
        return {
          number: util.toHex(block.header.number),
          hash: util.toHex(block.hash()),
          parentHash: util.toHex(block.header.parentHash),
          nonce: '0x0000000000000000',
          sha3Uncles: util.toHex(block.header.uncleHash),
          logsBloom: util.toHex(block.header.bloom),
          transactionsRoot: util.toHex(block.header.transactionsTrie),
          stateRoot: util.toHex(block.header.stateRoot),
          miner: util.toHex(block.header.coinbase),
          difficulty: util.toHex(block.header.difficulty),
          // TODO: calculate total difficulty for the block
          totalDifficulty: util.toHex(block.header.difficulty), 
          extraData: util.toHex(block.header.extraData),
          size: util.toHex(block.serialize(true).length),
          gasLimit: util.toHex(block.header.gasLimit),
          minGasPrice: util.toHex(_(block.transactions).map('gasPrice').map(util.toNumber).min()),
          // TODO: Fix the bug because of which block.header.gasPrice is empty
          gasUsed: util.toHex(block.header.gasUsed),
          timestamp: util.toHex(block.header.timestamp),
          // TODO: Add support of fullTransactions=true
          transactions: _(block.transactions).invoke('hash').map(util.toHex),
          uncles: []
        };
      }
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
