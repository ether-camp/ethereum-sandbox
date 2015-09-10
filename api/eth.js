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
      cb = util.jsonRpcCallback(cb);
      var errors = [];
      address = parse.types.address(address, errors);
      if (errors.length != 0) return cb(errors.join(' '));
      sandbox.vm.trie.get(util.toBuffer(address), function(err, data) {
        if (err) cb(err);
        else cb(null, util.toHex(Object.create(Account).init(data).balance));
      });
    },
    getStorageAt: function(address, position, block, cb) {
      cb = util.jsonRpcCallback(cb);
      var errors = [];
      address = parse.types.address(address, errors);
      position = util.toHex(parse.types.number(position, errors), 64);
      if (errors.length != 0) return cb(errors.join(' '));
      sandbox.vm.trie.get(util.toBuffer(address), function(err, data) {
        if (err) cb(err);
        else {
          Object.create(Account).init(data).readStorage(sandbox.vm.trie, function(err, storage) {
            if (err) cb(err);
            else cb(null, storage.hasOwnProperty(position) ? storage[position] : null);
          });
        }
      });
    },
    getTransactionCount: function(address, block, cb) {
      cb(null, util.toHex(_(sandbox.receipts).where({from: address}).size()));
    },
    getBlockTransactionCountByHash: function(block, cb) {
      cb(null, util.toHex(_(sandbox.receipts).where({blockHash: block}).size()));
    },
    getBlockTransactionCountByNumber: function(block, cb) {
      cb = util.jsonRpcCallback(cb);
      if (block === 'earliest') send(new BigNumber(0));
      else if (block === 'latest')
        sandbox.blockchain.getHead(function(err, lastBlock) {
          if (err) cb(err);
          else send(util.toBigNumber(lastBlock.header.number));
        });
      else if (block === 'pending') cb(null, '0x0');
      else {
        var errors = [];
        block = parse.types.number(block, errors);
        if (errors.length !== 0) cb(errors.join(' '));
        else send(block);
      }

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
      var errors = [];
      address = parse.types.address(address, errors);
      if (errors.length != 0) cb(errors.join(' '), null);
      else sandbox.vm.trie.get(util.toBuffer(address), function(err, data) {
        if (err) cb(err);
        else Object.create(Account).init(data).readCode(sandbox.vm.trie, cb);
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
    getBlockByHash: function(blockHash, fullTx, cb) {
      var errors = [];
      blockHash = parse.types.hex64(blockHash, errors);
      fullTx = parse.types.bool(fullTx, errors);
      if (errors.length !== 0) cb(errors.join(' '));
      else sandbox.blockchain.getBlock(util.toBuffer(blockHash), function(err, block) {
        if (err) cb(err);
        else if (!block) cb();
        else cb(null, Object.create(Block).init(block).getDetails(fullTx));
      });
    },
    getBlockByNumber: function(blockNumber, fullTx, cb) {
      cb = util.jsonRpcCallback(cb);
      var errors = [];
      blockNumber = parse.types.number(blockNumber, errors);
      fullTx = parse.types.bool(fullTx, errors);
      if (errors.length !== 0) return cb(errors.join(' '));
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
    },
    getTransactionByHash: function(txHash, cb) {
      cb = util.jsonRpcCallback(cb);
      var errors = [];
      txHash = parse.types.hex64(txHash, errors);
      if (errors.length !== 0) cb(errors.join(' '));
      else if (!sandbox.receipts.hasOwnProperty(txHash)) cb();
      else cb(null, sandbox.receipts[txHash].getTxDetails());
    },
    getTransactionByBlockHashAndIndex: function(blockHash, txIndex, cb) {
      cb = util.jsonRpcCallback(cb);
      var errors = [];
      blockHash = parse.types.hex64(blockHash, errors);
      txIndex = parse.types.number(txIndex, errors);
      if (errors.length !== 0) return cb(errors.join(' '));
      var receipt = _.find(sandbox.receipts, function(receipt) {
        return receipt.blockHash === blockHash && receipt.txIndex.equals(txIndex);
      });
      cb(null, receipt ? receipt.getTxDetails() : null);
    },
    getTransactionByBlockNumberAndIndex: function(blockNumber, txIndex, cb) {
      cb = util.jsonRpcCallback(cb);
      var errors = [];
      blockNumber = parse.types.number(blockNumber, errors);
      txIndex = parse.types.number(txIndex, errors);
      if (errors.length !== 0) return cb(errors.join(' '));
      var receipt = _.find(sandbox.receipts, function(receipt) {
        return receipt.blockNumber.equals(blockNumber) && receipt.txIndex.equals(txIndex);
      });
      cb(null, receipt ? receipt.getTxDetails() : null);
    },
    getTransactionReceipt: function(txHash, cb) {
      cb = util.jsonRpcCallback(cb);
      var errors = [];
      txHash = parse.types.hex64(txHash, errors)
      if (errors.length !== 0) cb(errors.join(' '));
      else if (!sandbox.receipts.hasOwnProperty(txHash)) cb();
      else cb(null, sandbox.receipts[txHash].getReceiptDetails());
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
