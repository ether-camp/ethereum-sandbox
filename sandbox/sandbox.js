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
var VM = require('ethereumjs-vm');
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
var parseContracts = require('../ast/parser');

var dbDir = './db/';

var Sandbox = Object.create(new EventEmitter());

Sandbox.DEFAULT_TX_GAS_PRICE = new BigNumber(50000000000),
Sandbox.DEFAULT_TX_GAS_LIMIT = new BigNumber(3141592),

Sandbox.init = function(id, cb) {
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
  this.pendingTransactions = [];
  this.receipts = {};
  this.createVM(cb);
  this.miner = setInterval(this.mineBlock.bind(this, function() {}), 5000);
  this.logListeners = [];
  this.projectName = null;
  this.resumeCb = null;
  this.prevBreakpoint = null;
  this.inStepInto = false;
  this.callStack = [];
  this.hashDict = [];
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
Sandbox.createVM = function(cb) {
  async.series([
    createBlockchain.bind(this),
    createVM.bind(this)
  ], cb);

  function createBlockchain(cb) {
    createIfNotExists(dbDir);
    var blockDB = levelup(dbDir + this.id);
    this.blockchain = new Blockchain(blockDB, false);
    var block = new Block({
      header: {
        coinbase: util.toBuffer(this.coinbase),
        gasLimit: util.toBuffer(this.gasLimit),
        number: 0,
        difficulty: util.toBuffer(this.difficulty),
        timestamp: new Buffer(util.nowHex(), 'hex')
      }, transactions: [],
      uncleHeaders: []
    });
    this.blockchain.putBlock(block, cb);

    function createIfNotExists(dir) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }
    }
  }
  function createVM(cb) {
    var self = this;
    this.vm = new VM(new Trie(), this.blockchain);
    this.vm.on('step', function(data, cb) {
      if (data.opcode.name == 'SHA3') {
        var offsetBuf = data.stack[data.stack.length - 1];
        var offset = offsetBuf.readUIntBE(0, offsetBuf.length) || 0;
        var lengthBuf = data.stack[data.stack.length - 2];
        var length = lengthBuf.readUIntBE(0, lengthBuf.length) || 0;
        var src = new Buffer(data.memory.slice(offset, offset + length));
        self.hashDict.push({
          src: src,
          hash: util.sha3(src, 'binary')
        });
      }
      cb();
    });
    this.vm.on('step', (function(data, cb) {
      var address = '0x' + data.address.toString('hex');
      if (address in this.contracts) {
        var contract = this.contracts[address];
        var mapping = _.find(contract.srcmap, { pc: data.pc });
        var bp = null;
        if (this.inStepInto) {
          if (!matches(mapping, this.prevBreakpoint)) {
            bp = {
              line: mapping.line,
              column: mapping.column,
              source: mapping.source,
              path: contract.sourceList[mapping.source]
            };
            this.inStepInto = false;
          }
        } else {
          bp = _.find(contract.breakpoints, { line: mapping.line, source: mapping.source });

          if (this.prevBreakpoint && bp && matches(this.prevBreakpoint, bp)) bp = null;
          else this.prevBreakpoint = null;
        }

        if (!bp) return cb();

        var account = Object.create(Account).init(data.account);
        account.readStorage1(self.vm.trie, function(err, storage) {
          if (err) {
            console.error(err);
            return cb();
          }
          
          var vars = contract.details.getStorageVars(storage, self.hashDict);

          self.filters.newBreakpoint(bp, self.callStack, vars);
          self.prevBreakpoint = bp;
          self.resumeCb = cb;
          console.log('paused');
        });
      } else cb();
    }).bind(this));
    cb();
  }
  function matches(mapping, breakpoint) {
    return mapping.source == breakpoint.source && mapping.line == breakpoint.line;
  }
};
Sandbox.resume = function(cb) {
  if (this.resumeCb) {
    console.log('resume');
    this.resumeCb();
    this.resumeCb = null;
  }
  cb();
};
Sandbox.stop = function(cb) {
  this.emit('stop', this);
  clearInterval(this.miner);
  async.series([
    this.blockchain.db.close.bind(this.blockchain.db),
    leveldown.destroy.bind(leveldown, './db/' + this.id)
  ], (function(err) {
    if (err) return cb(err);
    this.removeAllListeners();
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
    this.pendingTransactions = null;
    this.logListeners = null;
    this.prevBreakpoint = null;
    this.resumeCb = null;
    this.prevBreakpoint = null;
    this.inStepInto = null;
    this.callStack = null;
    this.hashDict = null;
    cb();
  }).bind(this));
};
Sandbox.addAccount = function(address, pkey) {
  this.accounts[address] = pkey;
};
Sandbox.createAccount = util.synchronize(function(details, address, cb) {
  var account = Object.create(Account).init(details, address);
  var raw = account.raw();

  if (details.name) this.accountNames[address] = details.name;
  
  async.series([
    storeCode.bind(this),
    saveStorage.bind(this),
    (function(cb) {
      this.vm.trie.put(util.toBuffer(account.address), raw.serialize(), cb);
    }).bind(this),
    runCode.bind(this)
  ], cb);

  function runCode(cb) {
    if (!account.runCode) return cb();
    var address = util.toBuffer(account.address);
    this.createNextBlock([], (function(err, block) {
      if (err) return cb(err);
      this.vm.runCode({
        code: util.toBuffer(account.runCode.binary),
        data: util.toBuffer(account.runCode.binary),
        gasLimit: util.toBuffer(this.gasLimit),
        address: address,
        caller: util.toBuffer(this.coinbase),
        block: block
      }, (function(err, result) {
        if (err) return cb(err);
        
        this.contracts[account.address] = account.runCode;
        this.contracts[account.address].gasUsed = util.toHex(result.gasUsed);
        this.contracts[account.address].data = '0x' + account.runCode.binary;

        this.vm.trie.get(address, (function(err, data) {
          if (err) return cb(err);
          var acc = new EthAccount(data);
          acc.setCode(this.vm.trie, result.return, (function(err) {
            if (err) cb(err);
            else this.vm.trie.put(address, acc.serialize(), cb);
          }).bind(this));
        }).bind(this));
        
      }).bind(this));
    }).bind(this));
  }
  function storeCode(cb) {
    if (!account.code) cb();
    else raw.setCode(this.vm.trie, util.toBuffer(account.code), cb);
  }
  function saveStorage(cb) {
    if (!account.storage || _.size(account.storage) === 0) return cb();
    var strie = this.vm.trie.copy();
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
  if (!_.isString(options)) {
    if (!this.accounts.hasOwnProperty(options.from))
      return cb('Could not find a private key for ' + options.from);
    options.pkey = this.accounts[options.from];
  }
  
  var tx = Object.create(Tx).init(options);

  check.call(this, tx, (function(err) {
    if (err) return cb(err);
    cb(null, util.toHex(tx.getTx().hash()));
    this.addPendingTx(tx);
  }).bind(this));

  function check(tx, cb) {
    this.vm.trie.get(util.toBuffer(tx.from), (function(err, data) {
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
        var prevTx = _.find(this.pendingTransactions, { from: tx.from });
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
});
Sandbox.addPendingTx = function(tx) {
  this.filters.newPendingTx(tx);
  this.pendingTransactions.push(tx);
  this.runPendingTx();
};
Sandbox.runPendingTx = function() {
  if (this.miningBlock || this.pendingTransactions.length === 0) return;
  this.miningBlock = true;

  this.createNextBlock([this.pendingTransactions[0].getTx()], (function(err, block) {
    if (err) {
      this.miningBlock = false;
      return console.error(err);
    }
    async.series([
      this.vm.runBlock.bind(this.vm, {
        blockchain: this.blockchain,
        block: block,
        generate: true
      }),
      this.blockchain.putBlock.bind(this.blockchain, block)
    ], (function(err, results) {
      if (!this.vm) return;

      console.log('tx is finished');
      
      var tx = this.pendingTransactions.shift();
      this.miningBlock = false;
      this.runPendingTx();
      if (err) console.error(err);
      else {
        var receipt = Object.create(Receipt)
              .init(tx, block, results[0].receipts[0], results[0].results[0]);
        this.receipts[util.toHex(tx.getTx().hash())] = receipt;

        if (tx.contract && receipt.contractAddress) {
          var contract = this.contracts[receipt.contractAddress] = tx.contract;
          contract.gasUsed = util.toHex(receipt.gasUsed);
          contract.data = tx.data;
          contract.breakpoints = [];
          contract.details = _.find(parseContracts(contract.ast), { name: contract.name });

          async.parallel({
            code: (function(cb) {
              this.vm.trie.get(util.toBuffer(receipt.contractAddress), (function(err, data) {
                if (err) cb(err);
                else new EthAccount(data).getCode(this.vm.trie, cb);
              }).bind(this));
            }).bind(this),
            sources: _.partial(async.map, tx.contract.sourceList, _.partial(fs.readFile, _, 'utf8', _))
          }, (function(err, results) {
            if (err) console.error(err);
            else contract.srcmap = parseSourceMap(contract.srcmap, results.code, results.sources);
          }).bind(this));
        }

        this.filters.newBlock(block);
        this.newLogs(receipt.logs);
        this.filters.newLogs(receipt.logs);
      }
    }).bind(this));
  }).bind(this));

  function parseSourceMap(srcmap, code, sources) {
    var prev = {
      line: -1,
      column: -1,
      source: -1
    };
    var pc = 0;
    return _.map(srcmap.split(';'), function(details) {
      var entries = details.split(':');
      
      if (entries[0]) {
        var position = calcPosition(
          parseInt(entries[0]),
          sources[entries[2] ? parseInt(entries[2]) - 1 : prev.source]
        );
      } else {
        position = {
          line: prev.line,
          column: prev.column
        };
      }
      
      var mapping = {
        line: position.line,
        column: position.column,
        source: entries[2] ? parseInt(entries[2]) - 1 : prev.source,
        pc: pc
      };

      // skip push argument
      if (code[pc] >= 0x60 && code[pc] <= 0x7f) {
        pc += code[pc] - 0x60 + 1;
      }
      
      pc++;
      
      prev = mapping;
      return mapping;
    });
  }
  function calcPosition(offset, source) {
    var last = source.lastIndexOf('\n', offset);
    return {
      line: numberOf(source, '\n', offset),
      column: offset - (last > 0 ? last : 0)
    };

    function numberOf(str, c, len) {
      var n = 0;
      var index = 0;
      str = str.substr(0, len);
      while (true) {
        index = str.indexOf('\n', index) + 1;
        if (index <= 0) break;
        n++;
      }
      return n;
    }
  }
};
Sandbox.mineBlock = util.synchronize(function(cb) {
  if (this.miningBlock) return cb();
  this.miningBlock = true;
  this.createNextBlock([], (function(err, block) {
    if (err) {
      this.miningBlock = false;
      console.error(err);
      return cb();
    }
    this.blockchain.putBlock(block, (function(err) {
      this.miningBlock = false;
      if (err) console.error(err);
      else this.filters.newBlock(block);
      cb();
      this.runPendingTx();
    }).bind(this));
  }).bind(this));
});
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
      var prevTx = _.find(this.pendingTransactions, { from: tx.from });
      tx.nonce = prevTx ? prevTx.nonce.plus(1) : util.toBigNumber(account.nonce);
      cb();
    }).bind(this));
  }
  function run(cb) {
    this.blockchain.getHead((function(err, block) {
      if (err) cb(err);
      else this.vm.copy().runTx({ tx: tx.getTx(), block: block }, cb);
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
        timestamp: new Buffer(util.nowHex(), 'hex'),
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
  _.each(this.contracts, function(contract) {
    _.each(breakpoints, function(breakpoint) {
      var index = _.indexOf(contract.sourceList, breakpoint.source);
      if (index != -1) {
        contract.breakpoints.push({
          line: breakpoint.line.toNumber(),
          column: breakpoint.column.toNumber(),
          source: index,
          path: breakpoint.source
        });
        contract.breakpoints = _.sortBy(contract.breakpoints, 'line');
      }
    });
  });
  cb();
};
Sandbox.stepInto = function(cb) {
  this.inStepInto = true;
  this.resumeCb();
  cb();
};

module.exports = Sandbox;
