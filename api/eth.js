/*
 * Ethereum Sandbox
 * Copyright (C) 2016  <ether.camp> ALL RIGHTS RESERVED  (http://ether.camp)
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License version 3 for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
 
var util = require('../util');
var _ = require('lodash');
var BigNumber = require('bignumber.js');
var async = require('async');
var parse = require('../types/parse');
var Account = require('../ethereum/account');
var Block = require('../ethereum/block');

module.exports = function(services) {
  var sandbox = services.sandbox;
  var compiler = services.compiler;
  return {
    protocolVersion: {
      args: [],
      handler: function(cb) { cb(null, '54'); }
    },
    coinbase: {
      args: [],
      handler: function(cb) { cb(null, sandbox.coinbase); }
    },
    mining: {
      args: [],
      handler: function(cb) { cb(null, false); }
    },
    hashrate: {
      args: [],
      handler: function(cb) { cb(null, '0x0'); }
    },
    gasPrice: {
      args: [],
      handler: function(cb) { cb(null, '0x' + sandbox.gasPrice.toString(16)); }
    },
    accounts: {
      args: [],
      handler: function(cb) { cb(null, _.keys(sandbox.accounts)); }
    },
    blockNumber: {
      args: [],
      handler: function(cb) {
        sandbox.blockchain.getHead(function(err, block) {
          cb(null, block ? util.toHex(block.header.number) : null);
        });
      }
    },
    getBalance: {
      args: [
        { type: 'address' },
        { type: 'block' }
      ],
      handler: function(address, block, cb) {
        sandbox.vm.trie.get(util.toBuffer(address), function(err, data) {
          if (err) cb(err);
          else cb(null, util.toHex(Object.create(Account).init(data).balance));
        });
      }
    },
    getStorageAt: {
      args: [
        { type: 'address' },
        { type: 'number' },
        { type: 'block' }
      ],
      handler: function(address, position, block, cb) {
        position = util.toHex(position, 64);
        sandbox.vm.trie.get(util.toBuffer(address), function(err, data) {
          if (err) cb(err);
          else {
            Object.create(Account).init(data).readStorage(sandbox.vm.trie, function(err, storage) {
              if (err) cb(err);
              else cb(null, storage.hasOwnProperty(position) ? storage[position] : null);
            });
          }
        });
      }
    },
    getTransactionCount: {
      args: [
        { type: 'address' },
        { type: 'block' }
      ],
      handler: function(address, block, cb) {
        sandbox.vm.trie.get(util.toBuffer(address), function(err, data) {
          if (err) cb(err);
          else if (data === null) cb(null, '0x0');
          else cb(null, util.toHex(Object.create(Account).init(data).nonce));
        });
      }
    },
    getBlockTransactionCountByHash: {
      args: [{ type: 'hex64' }],
      handler: function(block, cb) {
        cb(null, util.toHex(_(sandbox.receipts).where({blockHash: block}).size()));
      }
    },
    getBlockTransactionCountByNumber: {
      args: [{ type: 'block' }],
      handler: function(block, cb) {
        if (block === 'earliest') send(new BigNumber(0));
        else if (block === 'latest')
          sandbox.blockchain.getHead(function(err, lastBlock) {
            if (err) cb(err);
            else send(util.toBigNumber(lastBlock.header.number));
          });
        else if (block === 'pending') cb(null, '0x0');
        else send(block);
        
        function send(number) {
          cb(null, util.toHex(_(sandbox.receipts).filter(function(receipt) {
            return receipt.blockNumber.equals(number);
          }).size()));
        }
      }
    },
    getUncleCountByBlockHash: {
      args: [{ type: 'hex64' }],
      handler: function(block, cb) { cb(null, '0x0'); }
    },
    getUncleCountByBlockNumber: {
      args: [{ type: 'block' }],
      handler: function(block, cb) { cb(null, '0x0'); }
    },
    getCode: {
      args: [
        { type: 'address' },
        { type: 'block' }
      ],
      handler: function(address, block, cb) {
        sandbox.vm.trie.get(util.toBuffer(address), function(err, data) {
          if (err) cb(err);
          else if (!data) cb(null, '0x');
          else Object.create(Account).init(data).readCode(sandbox.vm.trie, cb);
        });
      }
    },
    sendTransaction: {
      args: [{
        type: 'map',
        values: {
          from: { type: 'address' },
          to: { type: 'address', defaultVal: null },
          gas: { type: 'number', defaultVal: sandbox.getGasLimit.bind(sandbox) },
          gasPrice: { type: 'number', defaultVal: sandbox.getGasPrice.bind(sandbox) },
          value: { type: 'number', defaultVal: new BigNumber(0) },
          data: { type: 'hex', defaultVal: null },
          nonce: { type: 'number', defaultVal: null },
          contract: { type: 'contract', defaultVal: null }
        }
      }],
      handler: function(options, cb) {
        options.gasLimit = options.gas;
        delete options.gas;
        sandbox.sendTx(options, cb);
      }
    },
    sendRawTransaction: {
      args: [{ type: 'hex' }],
      handler: function(rlp, cb) {
        sandbox.sendTx(rlp, cb);
      }
    },
    call: {
      args: [
        {
          type: 'map',
          values: {
            from: { type: 'address', defaultVal: sandbox.getDefaultAccount.bind(sandbox) },
            to: { type: 'address', defaultVal: null },
            gas: { type: 'number', defaultVal: sandbox.getGasLimit.bind(sandbox) },
            gasPrice: { type: 'number', defaultVal: sandbox.getGasPrice.bind(sandbox) },
            value: { type: 'number', defaultVal: new BigNumber(0) },
            data: { type: 'hex', defaultVal: null },
            nonce: { type: 'number', defaultVal: null }
          }
        },
        { type: 'block' }
      ],
      handler: function(options, block, cb) {
        options.gasLimit = options.gas;
        delete options.gas;
        sandbox.call(options, function(err, result) {
          if (err) cb(err);
          else cb(
            null,
            result.vm.hasOwnProperty('return') ? util.toHex(result.vm.return) : '0x0'
          );
        });
      }
    },
    estimateGas: {
      args: [
        {
          type: 'map',
          values: {
            from: { type: 'address', defaultVal: sandbox.getDefaultAccount.bind(sandbox) },
            to: { type: 'address', defaultVal: null },
            gas: { type: 'number', defaultVal: sandbox.getGasLimit.bind(sandbox) },
            gasPrice: { type: 'number', defaultVal: sandbox.getGasPrice.bind(sandbox) },
            value: { type: 'number', defaultVal: new BigNumber(0) },
            data: { type: 'hex', defaultVal: null },
            nonce: { type: 'number', defaultVal: null }
          }
        },
        { type: 'block' }
      ],
      handler: function(options, block, cb) {
        options.gasLimit = options.gas;
        delete options.gas;
        sandbox.call(options, function(err, result) {
          cb(err, result ? util.toHex(util.toBigNumber(result.gasUsed)) : null);
        });
      }
    },
    getBlockByHash: {
      args: [
        { type: 'hex64' },
        { type: 'bool' }
      ],
      handler: function(blockHash, fullTx, cb) {
        sandbox.blockchain.getBlock(util.toBuffer(blockHash), function(err, block) {
          if (err) cb(err.hasOwnProperty('message') ? err.message : err);
          else if (!block) cb();
          else cb(null, Object.create(Block).init(block).getDetails(fullTx));
        });
      }
    },
    getBlockByNumber: {
      args: [
        { type: 'block' },
        { type: 'bool' }
      ],
      handler: function(blockNumber, fullTx, cb) {
        if (blockNumber == 'latest') blockNumber = sandbox.blockchain.meta.height;
        else if (blockNumber == 'earliest') blockNumber = 0;
        else if (blockNumber == 'pending') return cb();
        else {
          blockNumber = blockNumber.toNumber();
          if (sandbox.blockchain.meta.height < blockNumber) return cb();
        }
        sandbox.blockchain.getHead(function(err, currBlock) {
          if (err) return cb(err);
          async.whilst(
            function() {
              return util.toNumber(currBlock.header.number) !== blockNumber;
            },
            function(cb) {
              sandbox.blockchain.getBlock(currBlock.header.parentHash, function(err, block) {
                if (err) cb(err);
                else {
                  currBlock = block;
                  cb();
                }
              });
            },
            function(err) {
              if (err) cb(err);
              else cb(null, Object.create(Block).init(currBlock).getDetails(fullTx));
            }
          );
        });
      }
    },
    getTransactionByHash: {
      args: [{ type: 'hex64' }],
      handler: function(txHash, cb) {
        if (!sandbox.receipts.hasOwnProperty(txHash)) cb();
        else cb(null, sandbox.receipts[txHash].getTxDetails());
      }
    },
    getTransactionByBlockHashAndIndex: {
      args: [
        { type: 'hex64' },
        { type: 'number' }
      ],
      handler: function(blockHash, txIndex, cb) {
        var receipt = _.find(sandbox.receipts, function(receipt) {
          return receipt.blockHash === blockHash && receipt.txIndex.equals(txIndex);
        });
        cb(null, receipt ? receipt.getTxDetails() : null);
      }
    },
    getTransactionByBlockNumberAndIndex: {
      args: [
        { type: 'block' },
        { type: 'number' }
      ],
      handler: function(blockNumber, txIndex, cb) {
        var receipt = _.find(sandbox.receipts, function(receipt) {
          return receipt.blockNumber.equals(blockNumber) && receipt.txIndex.equals(txIndex);
        });
        cb(null, receipt ? receipt.getTxDetails() : null);
      }
    },
    getTransactionReceipt: {
      args: [{ type: 'hex64' }],
      handler: function(txHash, cb) {
        if (!sandbox.receipts.hasOwnProperty(txHash)) cb();
        else cb(null, sandbox.receipts[txHash].getReceiptDetails());
      }
    },
    getUncleByBlockHashAndIndex: {
      args: [
        { type: 'hex64' },
        { type: 'number' }
      ],
      handler: function(blockHash, uncleIndex, cb) { cb(null, null); }
    },
    getUncleByBlockNumberAndIndex: {
      args: [
        { type: 'block' },
        { type: 'number' }
      ],
      handler: function(blockNumber, uncleIndex, cb) { cb(null, null); }
    },
    getCompilers: {
      args: [],
      handler: function(cb) { cb(null, ['solidity']); }
    },
    compileSolidity: {
      args: [{ type: 'string' }],
      handler: function(source, cb) {
        compiler.compile(source, cb);
      }
    },
    newFilter: {
      args: [{
        type: 'map',
        values: {
          fromBlock: { type: 'block', defaultVal: 'latest' },
          toBlock: { type: 'block', defaultVal: 'latest' },
          address: { type: 'address', defaultVal: null },
          topics: {
            type: 'array',
            defaultVal: [],
            values: { type: 'hex', defaultVal: '' }
          }
        }
      }],
      handler: function(options, cb) {
        cb(null, sandbox.filters.addFilter(options));
      }
    },
    newBlockFilter: {
      args: [],
      handler: function(cb) { cb(null, sandbox.filters.addBlockFilter()); }
    },
    newPendingTransactionFilter: {
      args: [],
      handler: function(cb) { cb(null, sandbox.filters.addPendingTxFilter()); }
    },
    uninstallFilter: {
      args: [{ type: 'hex' }],
      handler: function(filterId, cb) {
        sandbox.filters.removeFilter(filterId);
        cb();
      }
    },
    getFilterChanges: {
      args: [{ type: 'hex' }],
      handler: function(filterId, cb) {
        cb(null, sandbox.filters.getChanges(filterId));
      }
    },
    getFilterLogs: {
      args: [{ type: 'hex' }],
      handler: function(filterId, cb) {
        cb(null, sandbox.filters.getEntries(filterId));
      }
    },
    getLogs: {
      args: [{
        type: 'map',
        values: {
          fromBlock: { type: 'block', defaultVal: 'latest' },
          toBlock: { type: 'block', defaultVal: 'latest' },
          address: { type: 'address', defaultVal: null }
        }
      }],
      handler: function(options, cb) {
        sandbox.blockchain.getHead(function(err, block) {
          var latest = util.toBigNumber(block.header.number);
          if (options.fromBlock == 'pending') options.fromBlock = latest;
          else if (options.fromBlock == 'latest') options.fromBlock = latest;
          else if (options.fromBlock == 'earliest') options.fromBlock = 0;

          if (options.toBlock == 'pending') options.toBlock = latest;
          else if (options.toBlock == 'latest') options.toBlock = latest;
          else if (options.toBlock == 'earliest') options.toBlock = 0;

          var logs = _(sandbox.receipts)
                .filter(function(receipt) {
                  return receipt.blockNumber.greaterThanOrEqualTo(options.fromBlock) &&
                    receipt.blockNumber.lessThanOrEqualTo(options.toBlock);
                })
                .map('logs')
                .flatten();
          if (options.address) logs = logs.filter({ address: options.address });
          cb(null, logs.value());
        });
      }
    }
  };
};
