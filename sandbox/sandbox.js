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
 
var fs = require('fs');
var EventEmitter = require('events').EventEmitter;
var VM = require('./vm');
var EthAccount = require('ethereumjs-account');
var Block = require('ethereumjs-block');
var Blockchain = require('ethereumjs-blockchain');
var Trie = require('merkle-patricia-tree');
var ethUtils = require('ethereumjs-util');
var async = require('async');
var _ = require('lodash');
var levelup = require('levelup');
var leveldown = require('leveldown');
var BigNumber = require('bignumber.js');
var util = require('../util');
var Tx = require('../ethereum/tx');
var Receipt = require('../ethereum/receipt');
var Filters = require('./filters');
var Account = require('../ethereum/account');
var SHA3Hash = require('sha3').SHA3Hash;
var Contract = require('./contract');
var Debugger = require('./debugger');
var Txs = require('./txs');

var dbDir = './db/';

var Sandbox = Object.create(new EventEmitter());

Sandbox.DEFAULT_TX_GAS_PRICE = new BigNumber(50000000000);
Sandbox.DEFAULT_TX_GAS_LIMIT = new BigNumber(3141592);

Sandbox.init = function(id, config, cb) {
  this.id = id;
  this.coinbase = '0x1337133713371337133713371337133713371337';
  this.defaultAccount = null;
  this.accounts = {};
  this.transactions = [];
  this.contracts = {};
  this.accountNames = {};
  this.filters = Object.create(Filters).init(this);
  this.gasLimit = this.DEFAULT_TX_GAS_LIMIT;
  this.gasPrice = this.DEFAULT_TX_GAS_PRICE;
  this.difficulty = new BigNumber(1000);
  this.miningBlock = false;
  this.txs = Object.create(Txs).init();
  this.receipts = {};
  this.logListeners = [];
  this.projectName = null;
  this.hashDict = [];
  this.timeOffset = 0;
  this.timestamp = 0;
  this.keepTimestampConstant = false;
  this.minePeriod = 5000;
  this.minerEnabled = true;
  
  this.createVM(config.debug, cb);
};
Sandbox.getCoinbase = function() {
  return this.coinbase;
};
Sandbox.getDefaultAccount = function() {
  return this.defaultAccount;
};
Sandbox.getGasLimit = function() {
  return this.gasLimit;
};
Sandbox.getGasPrice = function() {
  return this.gasPrice;
};
Sandbox.createVM = function(debug, cb) {
  var self = this;
  
  async.series([
    createBlockchain,
    createVM,
    startMiner
  ], cb);
  
  function createBlockchain(cb) {
    createIfNotExists(dbDir);
    var blockDB = levelup(dbDir + self.id);
    self.blockchain = new Blockchain(blockDB, false);
    var block = new Block({
      header: {
        coinbase: util.toBuffer(self.coinbase),
        gasLimit: util.toBuffer(self.gasLimit),
        number: 0,
        difficulty: util.toBuffer(self.difficulty),
        timestamp: new Buffer(util.nowHex(self.timeOffset), 'hex')
      }, transactions: [],
      uncleHeaders: []
    });
    self.blockchain.putBlock(block, cb);

    function createIfNotExists(dir) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }
    }
  }
  function createVM(cb) {

    self.vm = Object.create(VM).init({
      state: new Trie(),
      blockchain: self.blockchain,
      activatePrecompiles: true,
      enableHomestead: true
    }, self, debug);

    cb();
  }
  function startMiner(cb) {
    setTimeout(self.mineBlock.bind(self, util.showError), self.minePeriod);
    cb();
  }
};
Sandbox.resume = function(cb) {
  this.vm.resume();
  cb();
};
Sandbox.stop = util.synchronize(function(cb) {
  this.emit('stop', this);
  this.stopMiner();
  async.series([
    this.blockchain.db.close.bind(this.blockchain.db),
    leveldown.destroy.bind(leveldown, './db/' + this.id)
  ], (function(err) {
    if (err) return cb(err);
    this.removeAllListeners();
    this.vm.destroy();
    this.vm = null;
    this.blockchain = null;
    this.block = null;
    this.coinbase = null;
    this.defaultAccount = null;
    this.transactions = null;
    this.contracts = null;
    this.accounts = null;
    this.filters.destroy();
    this.filters = null;
    this.receipts = null;
    this.txs = null;
    this.logListeners = null;
    this.hashDict = null;
    cb();
  }).bind(this));
});
Sandbox.addAccount = function(address, pkey) {
  this.accounts[address] = pkey;
};
Sandbox.createAccount = util.synchronize(function(details, address, cb) {
  var self = this;
  var account = Object.create(Account).init(details, address);
  var raw = account.raw();

  if (details.name) self.accountNames[address] = details.name;
  
  async.series([
    storeCode,
    saveStorage,
    function(cb) {
      self.vm.trie.put(util.toBuffer(account.address), raw.serialize(), cb);
    },
    runCode
  ], cb);

  function runCode(cb) {
    if (!account.runCode) return cb();

    Object.create(Contract).init(
      {
        data: account.runCode.binary,
        contract: account.runCode
      },
      self.vm.withDebug,
      function(err, contract) {
        if (err) return cb(err);
        self.contracts[account.address] = contract;
    
        var address = util.toBuffer(account.address);
        self.createNextBlock([], function(err, block) {
          if (err) return cb(err);
          var data = util.toBuffer(account.runCode.binary);
          self.vm.runCode({
            code: data,
            data: data,
            gasLimit: util.toBuffer(self.gasLimit),
            address: address,
            caller: util.toBuffer(self.coinbase),
            block: block
          }, function(err, result) {
            if (err) return cb(err);

            self.contracts[account.address].deploy(util.toHex(result.gasUsed), result.return, function(err) {
              if (err) return cb(err);
            
              self.vm.trie.get(address, function(err, data) {
                if (err) return cb(err);
                var acc = new EthAccount(data);
                acc.setCode(self.vm.trie, result.return, function(err) {
                  if (err) cb(err);
                  else self.vm.trie.put(address, acc.serialize(), cb);
                });
              });
            });
          });
        });
      }
    );
  }
  function storeCode(cb) {
    if (!account.code) cb();
    else raw.setCode(self.vm.trie, util.toBuffer(account.code), cb);
  }
  function saveStorage(cb) {
    if (!account.storage || _.size(account.storage) === 0) return cb();
    var strie = self.vm.trie.copy();
    strie.root = account.stateRoot;
    async.forEachOfSeries(
      account.storage,
      function(val, key, cb) {
        strie.put(util.toBuffer(key, 64), util.encodeRlp(util.toBuffer(val, 64)), function(err) {
          raw.stateRoot = strie.root;
          cb(err);
        });
      },
      cb
    );
  }
});
Sandbox.sendTx = util.synchronize(function(options, cb) {
  var self = this;
  if (!_.isString(options)) {
    if (!this.accounts.hasOwnProperty(options.from))
      return cb('Could not find a private key for ' + options.from);
    options.pkey = this.accounts[options.from];
  }
  
  var tx = Object.create(Tx).init(options);

  check.call(this, tx, function(err) {
    if (err) return cb(err);
    if (tx.contract) {
      Object.create(Contract).init(tx, self.vm.withDebug, function(err, contract) {
        if (err) return cb(err);
        var address = util.toHex(ethUtils.generateAddress(tx.from, tx.nonce.toNumber()));
        self.contracts[address] = contract;
        finish();
      });
    } else finish();
    
    function finish() {
      checkIfTargetAddressIsEmpty(tx, function() {
        self.txs.add(tx);
        self.filters.newPendingTx(tx);
        cb(null, util.toHex(tx.getTx().hash()));
        self.mineBlock(util.showError);
      });
    }
  });

  function check(tx, cb) {
    readAccount(util.toBuffer(tx.from), (function(err, data) {
      if (err) return cb(err);

      var account = new EthAccount(data);
      
      cb(checkGasLimit.call(this) || checkBalance.call(this) || checkNonce.call(this));
      
      function checkGasLimit() {
        if (tx.gasLimit.greaterThan(this.gasLimit)) {
          return 'The transaction has gas limit ' + tx.gasLimit.toString() +
            ' which is greater than current block gas limit ' + this.gasLimit.toString() + '.';
        }
        return null;
      }
      function checkBalance() {
        var advance = tx.gasLimit.times(tx.gasPrice).plus(tx.value);
        var balance = util.toBigNumber(account.balance);
        if (balance.lessThan(advance)) {
          return 'Account ' + tx.from + ' has only ' + balance.toString() +
            ' wei on its balance, but the transaction requires an advance in ' +
            advance.toString() + ' + ' + tx.value.toString() + ' wei.';
        }
        return null;
      }
      function checkNonce() {
        var prevTx = this.txs.getLatest(tx.from);
        if (prevTx) {
          var prevNonce = util.toBigNumber(prevTx.nonce);
          if (tx.nonce) {
            if (!tx.nonce.minus(1).equals(prevNonce)) {
              return 'The transaction has nonce ' + tx.nonce.toString() +
                ', but previous transaction from the account ' + tx.from +
                ' has nonce ' + prevNonce.toString() + '.';
            }
          } else {
            tx.nonce = prevNonce.plus(1);
          }
        } else {
          var accountNonce = util.toBigNumber(account.nonce);
          if (tx.nonce) {
            if (!tx.nonce.equals(accountNonce)) {
              return 'The transaction has nonce ' + tx.nonce.toString() +
                ', but current nonce of the account ' + tx.from +
                ' is ' + accountNonce.toString() + '.';
            }
          } else {
            tx.nonce = accountNonce;
          }
        }
        return null;
      }
    }).bind(this));
  }
  function checkIfTargetAddressIsEmpty(tx, cb) {
    if (tx.to) return cb();
    var target = ethUtils.generateAddress(tx.from, tx.nonce.toNumber());
    readAccount(target, function(err, data) {
      if (err) console.error(err);
      else if (data != null) {
        var hexTarget = '0x' + target.toString('hex');
        self.filters.newMessage({
          id: 'NEW_CONTRACT_AT_NOT_EMPTY_ACCOUNT',
          address: hexTarget,
          text: 'You are creating a contract at address ' + hexTarget +
            ' but it is not empty already. You probably created this account ' +
            'using web3.sandbox.createAccount().'
        });
      }
      cb();
    });
  }
  // workaround for https://github.com/ether-camp/ethereum-sandbox/issues/18
  function readAccount(address, cb) {
    var tries = 5;
    var data;
    async.whilst(
      function() { return tries-- > 0 && !data; },
      function(cb) {
        self.vm.trie.get(address, function(err, d) {
          data = d;
          cb(err);
        });
      },
      function(err) {
        cb(err, data);
      }
    );
  }
});
Sandbox.mineBlock = util.synchronize(function(withRunNext, cb) {
  if (_.isFunction(withRunNext)) {
    cb = withRunNext;
    withRunNext = true;
  }
  if (withRunNext && !this.minerEnabled) return cb();

  var self = this;
  if (withRunNext) clearTimeout(this.nextMinerRun);

  var blockGasLimit = this.gasLimit;
  var txs = this.txs.getPendingTxs(blockGasLimit);
  this.txs.mining(txs);
  var block;

  async.series([
    createBlock,
    runBlock,
    putBlock
  ], function(err, results) {
    if (err) {
      if (withRunNext) nextRun();
      return cb(err);
    }

    self.txs.mined(txs);

    _.each(txs, function(tx, index) {
      var receipt = Object.create(Receipt)
            .init(tx, block, results[1].receipts[index], results[1].results[index]);
      self.receipts[util.toHex(tx.getTx().hash())] = receipt;
      
      if (tx.contract) {
        if (receipt.contractAddress) {
          self.vm.trie.get(util.toBuffer(receipt.contractAddress), function(err, data) {
            if (err) return console.error(err);
            new EthAccount(data).getCode(self.vm.trie, function(err, code) {
              if (err) return console.error(err);
              self.contracts[receipt.contractAddress].deploy(util.toHex(receipt.gasUsed), code, util.showError);
            });
          });
        } else {
          delete self.contracts[receipt.contractAddress];
        }
      }
      self.newLogs(receipt.logs);
      self.filters.newLogs(receipt.logs);
    });

    self.filters.newBlock(block);

    if (withRunNext) nextRun();
    cb();
  });

  function createBlock(cb) {
    self.createNextBlock(_.invoke(txs, 'getTx'), function(err, nextBlock) {
      block = nextBlock;
      cb(err);
    });
  }

  function runBlock(cb) {
    self.vm.runBlock({
      blockchain: self.blockchain,
      block: block,
      generate: true
    }, cb);
  }

  function putBlock(cb) {
    self.blockchain.putBlock(block, cb);
  }

  function nextRun() {
    if (self.txs.hasPending()) {
      self.mineBlock(util.showError);
    } else {
      self.nextMinerRun = setTimeout(self.mineBlock.bind(self, util.showError), self.minePeriod);
    }
  }
}, '_minerLock');
Sandbox.call = util.synchronize(function(options, cb) {
  if (!this.accounts.hasOwnProperty(options.from))
    return cb('Could not find a private key for ' + options.from);
  options.pkey = this.accounts[options.from];

  var tx = Object.create(Tx).init(options);
  
  async.series([
    setNonce.bind(this),
    run.bind(this)
  ], function(err, results) {
    if (err) cb(err);
    else cb(null, results[1]);
  });
  
  function setNonce(cb) {
    this.vm.trie.get(util.toBuffer(options.from), (function(err, data) {
      if (err) return cb(err);
      
      var account = new EthAccount(data);
      var prevTx = this.txs.getLatest(tx.from);
      tx.nonce = prevTx ? prevTx.nonce.plus(1) : util.toBigNumber(account.nonce);
      cb();
    }).bind(this));
  }
  function run(cb) {
    this.blockchain.getHead((function(err, block) {
      if (err) cb(err);
      else this.vm.clone().runTx({ tx: tx.getTx(), block: block }, cb);
    }).bind(this));
  }
});
Sandbox.createNextBlock = function(transactions, cb) {
  this.blockchain.getHead((function(err, lastBlock) {
    if (err) return cb(err);
    var block = new Block({
      header: {
        coinbase: util.toBuffer(this.coinbase),
        gasLimit: util.toBuffer(this.gasLimit),
        number: ethUtils.bufferToInt(lastBlock.header.number) + 1,
        timestamp: new Buffer(this.keepTimestampConstant ? util.pad(this.timestamp.toString(16)) : util.nowHex(this.timeOffset), 'hex'),
        difficulty: util.toBuffer(this.difficulty),
        parentHash: lastBlock.hash()
      }, transactions: transactions || [],
      uncleHeaders: []
    });
    cb(null, block);
  }).bind(this));
};
Sandbox.onLog = function(details, cb) {
  this.logListeners.push({
    details: details,
    cb: cb
  });
};
Sandbox.newLogs = function(logs) {
  _.each(this.logListeners, function(listener) {
    _(logs)
      .filter(function(log) {
        if (listener.details.hasOwnProperty('address')) {
          return log.address == listener.details.address;
        }
        return true;
      })
      .each(function(log) {
        listener.cb(log);
      })
      .value();
  });
};
Sandbox.setBreakpoints = function(breakpoints, cb) {
  this.vm.setBreakpoints(breakpoints);
  cb();
};
Sandbox.removeBreakpoints = function(breakpoints, cb) {
  this.vm.removeBreakpoints(breakpoints);
  cb();
};
Sandbox.stepInto = function(cb) {
  this.vm.stepInto();
  cb();
};
Sandbox.stepOver = function(cb) {
  this.vm.stepOver();
  cb();
};
Sandbox.stepOut = function(cb) {
  this.vm.stepOut();
  cb();
};
Sandbox.startMiner = function() {
  this.minerEnabled = true;
  this.mineBlock(util.showError);
};
Sandbox.stopMiner = function() {
  this.minerEnabled = false;
  clearTimeout(this.nextMinerRun);
};

module.exports = Sandbox;
