var util = require('../util');
var _ = require('lodash');
var BigNumber = require('bignumber.js');
var async = require('async');
var childProcess = require('child_process');
var parse = require('../types/parse');
var Account = require('../ethereum/account');
var Block = require('../ethereum/block');

module.exports = function(sandbox) {
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
      handler: function(cb) { cb(null, '0x0'); }
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
          gas: { type: 'number', defaultVal: sandbox.gasLimit },
          gasPrice: { type: 'number', defaultVal: sandbox.gasPrice },
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
            from: { type: 'address', defaultVal: sandbox.defaultAccount },
            to: { type: 'address', defaultVal: null },
            gas: { type: 'number', defaultVal: sandbox.gasLimit },
            gasPrice: { type: 'number', defaultVal: sandbox.gasPrice },
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
            from: { type: 'address', defaultVal: sandbox.defaultAccount },
            to: { type: 'address', defaultVal: null },
            gas: { type: 'number', defaultVal: sandbox.gasLimit },
            gasPrice: { type: 'number', defaultVal: sandbox.gasPrice },
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
          if (err) cb(err);
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
        blockNumber = blockNumber.toNumber();
        if (sandbox.blockchain.meta.height < blockNumber) return cb();
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
      handler: function(code, cb) {
        var solc = childProcess.spawn('solc', ['--combined-json', 'bin,abi,devdoc,userdoc']);
        var out = '', err = '';
        solc.stdout.on('data', function(data) {
          out += data.toString();
        });
        solc.stdout.on('end', done);
        solc.stderr.on('data', function(data) {
          err += data.toString();
        });
        solc.stderr.on('end', done);
        
        solc.stdin.end(code, 'utf8');
        
        var calls = 0;
        function done() {
          if (++calls != 2) return;
          if (err) return cb(err);
          try {
            var parsed = JSON.parse(out);
          } catch (e) {
            return cb(out);
          }
          cb(null, _(parsed.contracts).transform(function (result, info, name) {
            result[name] = {
              code: '0x' + info.bin,
              info: {
                source: code,
                abiDifinition: JSON.parse(info.abi),
                userDoc: JSON.parse(info.userdoc),
                developerDoc: JSON.parse(info.devdoc)
              }
            }
          }));
        }
      }
    },
    newFilter: {
      args: [{
        type: 'map',
        values: {
          fromBlock: { type: 'block', defaultVal: 'latest' },
          toBlock: { type: 'block', defaultVal: 'latest' },
          address: { type: 'address', defaultVal: null }
        }
      }],
      handler: function(options, cb) { sandbox.newFilter(options, cb); }
    },
    newBlockFilter: {
      args: [],
      handler: function(cb) { sandbox.newFilter('latest', cb); }
    },
    newPendingTransactionFilter: {
      args: [],
      handler: function(cb) { sandbox.newFilter('pending', cb); }
    },
    uninstallFilter: {
      args: [{ type: 'hex' }],
      handler: function(filterId, cb) { sandbox.removeFilter(filterId, cb); }
    },
    getFilterChanges: {
      args: [{ type: 'hex' }],
      handler: function(filterId, cb) { sandbox.getFilterChanges(filterId, cb); }
    },
    getFilterLogs: {
      args: [{ type: 'hex' }],
      handler: function(filterId, cb) { sandbox.getFilterChanges(filterId, cb); }
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
          if (options.fromBlock == 'latest') options.fromBlock = latest;
          if (options.fromBlock == 'earliest') options.fromBlock = 0;
          if (options.toBlock == 'latest') options.toBlock = latest;
          if (options.toBlock == 'earliest') options.toBlock = 0;

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
