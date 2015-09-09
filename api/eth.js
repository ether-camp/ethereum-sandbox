var util = require('../util');
var _ = require('lodash');
var BigNumber = require('bignumber.js');
var async = require('async');
var childProcess = require('child_process');
var parse = require('../types/parse');
var Account = require('../ethereum/account');

module.exports = function(sandbox) {
  return {
    protocolVersion: function(cb) {
      cb(null, '54');
    },
    coinbase: function(cb) {
      cb(null, sandbox.coinbase);
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
        cb(null, block ? util.toHex(block.header.number) : null);
      });
    },
    getBalance: function(address, block, cb) {
      var errors = [];
      address = parse.types.address(address, errors);
      if (errors.length != 0) cb(errors.join(' '), null);
      sandbox.vm.trie.get(util.toBuffer(address), function(err, data) {
        if (err) cb(err, null);
        else cb(null, util.toHex(Object.create(Account).init(data).balance));
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
      cb = util.jsonRpcCallback(cb);
      var errors = [];
      options = parse(options, {
        from: { type: 'address' },
        to: { type: 'address', defaultVal: null },
        gas: { type: 'number', defaultVal: sandbox.gasLimit },
        gasPrice: { type: 'number', defaultVal: sandbox.gasPrice },
        value: { type: 'number', defaultVal: new BigNumber(0) },
        data: { type: 'hex', defaultVal: null },
        nonce: { type: 'number', defaultVal: null },
        contract: { type: 'contract', defaultVal: null }
      }, errors);
      if (errors.length !== 0) {
        cb(errors.join(' '));
      } else {
        options.gasLimit = options.gas;
        delete options.gas;
        sandbox.sendTx(options, cb);
      }
    },
    call: function(options, block, cb) {
      cb = util.jsonRpcCallback(cb);
      var errors = [];
      options = parse(options, {
        from: { type: 'address', defaultVal: sandbox.defaultAccount },
        to: { type: 'address', defaultVal: null },
        gas: { type: 'number', defaultVal: sandbox.gasLimit },
        gasPrice: { type: 'number', defaultVal: sandbox.gasPrice },
        value: { type: 'number', defaultVal: new BigNumber(0) },
        data: { type: 'hex', defaultVal: null },
        nonce: { type: 'number', defaultVal: null }
      }, errors);
      if (errors.length !== 0) {
        cb(errors.join(' '));
      } else {
        options.gasLimit = options.gas;
        delete options.gas;
        sandbox.call(options, function(err, result) {
          if (err) cb(err)
          else cb(
            null,
            result.vm.hasOwnProperty('return') ? util.toHex(util.toBigNumber(result.vm.return)) : '0x0'
          );
        });
      }
    },
    estimateGas: function(options, block, cb) {
      cb = util.jsonRpcCallback(cb);
      var errors = [];
      options = parse(options, {
        from: { type: 'address', defaultVal: sandbox.defaultAccount },
        to: { type: 'address', defaultVal: null },
        gas: { type: 'number', defaultVal: sandbox.gasLimit },
        gasPrice: { type: 'number', defaultVal: sandbox.gasPrice },
        value: { type: 'number', defaultVal: new BigNumber(0) },
        data: { type: 'hex', defaultVal: null },
        nonce: { type: 'number', defaultVal: null }
      }, errors);
      if (errors.length !== 0) {
        cb(errors.join(' '));
      } else {
        options.gasLimit = options.gas;
        delete options.gas;
        sandbox.call(options, function(err, result) {
          cb(err, result ? util.toHex(util.toBigNumber(result.gasUsed)) : null);
        });
      }
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
    getTransactionByHash: function(txHash, cb) {
      if (!sandbox.receipts.hasOwnProperty(txHash)) return cb(null, null);
      var receipt = sandbox.receipts[txHash];
      cb(null, receipt.getTxDetails());
    },
    getTransactionByBlockHashAndIndex: function(blockHash, txIndex, cb) {
      cb = util.jsonRpcCallback(cb);
      txIndex = util.toBigNumber(txIndex);
      var receipt = _.find(sandbox.receipts, function(receipt) {
        return receipt.blockHash === blockHash && receipt.txIndex.equals(txIndex);
      });
      if (!receipt) cb(null, null);
      else cb(null, receipt.getTxDetails());
    },
    getTransactionByBlockNumberAndIndex: function(blockNumber, txIndex, cb) {
      cb = util.jsonRpcCallback(cb);
      blockNumber = util.toBigNumber(blockNumber);
      txIndex = util.toBigNumber(txIndex);
      var receipt = _.find(sandbox.receipts, function(receipt) {
        return receipt.blockNumber.equals(blockNumber) && receipt.txIndex.equals(txIndex);
      });
      if (!receipt) cb(null, null);
      else cb(null, receipt.getTxDetails());
    },
    getTransactionReceipt: function(hash, cb) {
      if (sandbox.receipts.hasOwnProperty(hash)) {
        var receipt = sandbox.receipts[hash];
        cb(null, receipt.getReceiptDetails());
      } else cb(null, null);
    },
    getUncleByBlockHashAndIndex: function(blockHash, uncleIndex, cb) {
      cb(null, null);
    },
    getUncleByBlockNumberAndIndex: function(blockNumber, uncleIndex, cb) {
      cb(null, null);
    },
    getCompilers: function(cb) {
      cb(null, ['solidity']);
    },
    compileSolidity: function(code, cb) {
      cb = util.jsonRpcCallback(cb);
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
          return cb(out, null);
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
    },
    newFilter: function(options, cb) {
      sandbox.newFilter(options, util.jsonRpcCallback(cb));
    },
    newBlockFilter: function(cb) {
      sandbox.newFilter('latest', util.jsonRpcCallback(cb));
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
