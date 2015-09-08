var VM = require('ethereumjs-vm');
var Account = require('ethereumjs-account');
var Block = require('ethereumjs-block');
var Blockchain = require('ethereumjs-blockchain');
var Trie = require('merkle-patricia-tree');
var rlp = require('rlp');
var ethUtils = require('ethereumjs-util');
var async = require('async');
var SHA3Hash = require('sha3').SHA3Hash;
var _ = require('lodash');
var levelup = require('levelup');
var BigNumber = require('bignumber.js');
var util = require('../util');
var Tx = require('../ethereum/tx')
var Receipt = require('../ethereum/receipt');

var Sandbox = {
  SHA3_RLP_NULL: '56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421',
  DEFAULT_TX_GAS_PRICE: new BigNumber(50000000000),
  DEFAULT_TX_GAS_LIMIT: new BigNumber(3141592),
  
  init: function(id, cb) {
    this.id = id;
    this.coinbase = new Buffer('1337133713371337133713371337133713371337', 'hex');
    this.defaultAccount = null;
    this.accounts = [];
    this.transactions = [];
    this.contracts = {};
    this.filtersCounter = 0;
    this.filters = {};
    this.gasLimit = this.DEFAULT_TX_GAS_LIMIT;
    this.gasPrice = this.DEFAULT_TX_GAS_PRICE;
    this.difficulty = new BigNumber(1000);
    this.miningBlock = false;
    this.pendingTransactions = [];
    this.receipts = {};
    this.createVM(cb);
    this.miner = setInterval(this.mineBlock.bind(this), 5000);
  },
  createVM: function(cb) {
    async.series([
      createBlockchain.bind(this),
      createVM.bind(this)
    ], cb);

    function createBlockchain(cb) {
      var blockDB = levelup('', { db: require('memdown') });
      this.blockchain = new Blockchain(blockDB, false);
      var block = new Block({
        header: {
          coinbase: this.coinbase,
          gasLimit: util.toBuffer(this.gasLimit),
          number: 0,
          difficulty: util.toBuffer(this.difficulty),
          timestamp: new Buffer(util.nowHex(), 'hex')
        }, transactions: [],
        uncleHeaders: []
      });
      this.blockchain.addBlock(block, cb);
    }
    function createVM(cb) {
      this.vm = new VM(new Trie(), this.blockchain);
      this.vm.onStep = (function(info, done) {
        if (_.startsWith(info.opcode.opcode, 'LOG')) {
          notify.call(this, info);
        }
        done();
      }).bind(this);
      cb();
    }
    function notify(info) {
      var stack = info.stack.slice();
      var topicNum = parseInt(info.opcode.opcode.substr(3));
      var offset = parseInt(stack.pop().toString('hex'), 16);
      var size = parseInt(stack.pop().toString('hex'), 16);
      var data = _(info.memory).slice(offset, offset + size)
            .chunk(32)
            .map(function(val) {
              return val
                .map(function(cell) {
                  return pad(cell.toString(16));
                })
                .join('');
            })
            .value();
      var topics = _.times(topicNum, function() {
        return '0x' + stack.pop().toString('hex');
      });
      var log = {
        logIndex: null,
        transactionIndex: null,
        transactionHash: null,
        blockHash: null,
        blockNumber: null,
        address: '0x' + info.address.toString('hex'),
        data: '0x' +  data.join(''),
        topics: topics
      };
      _.each(this.filters, function(filter) {
        if (filter.type === 'log') filter.entries.push(log);
      });
    }
  },
  setBlock: function(block) {
    if (!block) return;
    if (block.hasOwnProperty('coinbase')) this.coinbase = new Buffer(util.fillWithZeroes(block.coinbase.toString(16), 40), 'hex');
    if (block.hasOwnProperty('difficulty')) this.difficulty = block.difficulty;
    if (block.hasOwnProperty('gasLimit')) this.gasLimit = block.gasLimit;
  },
  createAccounts: function(accounts, cb) {
    accounts = _.map(accounts, function(account, address) {
      account.address = address;
      return util.toBuffers(account, ['address', 'nonce', 'balance', 'code', 'pkey']);
    });
    this.accounts = _(accounts)
      .filter(function(account) {
        return account.hasOwnProperty('pkey');
      }).map(function(account) {
        return [ util.toHex(account.address), util.toHex(account.pkey) ];
      }).zipObject().value();

    async.each(accounts, processAccount.bind(this), (function(err) {
      if (err) this.stop(cb.bind(null, 'Could not create an account: ' + err));
      else {
        if (this.defaultAccount === null) {
          this.stop(cb.bind(null, 'Please, specify a default account in ethereum.json'));
        } else {
          cb();
        }
      }
    }).bind(this));

    function processAccount(options, cb) {
      if (options.default) {
        if (this.defaultAccount !== null)
          return cb('There is should be only one default account. Please, correct ethereum.json.');
        
        if (!options.hasOwnProperty('pkey'))
          return cb('Default account in ethereum.json should have a pkey.');
        
        this.defaultAccount = util.toHex(options.address);
      }
      this.createAccount(options, cb);
    }
  },
  stop: function(cb) {
    clearInterval(this.miner);
    this.vm = null;
    this.blockchain = null;
    this.block = null;
    this.coinbase = null;
    this.defaultAccount = null;
    this.transactions = null;
    this.contracts = null;
    this.accounts = null;
    this.filters = null;
    this.filtersCounter = null;
    this.receipts = null;
    cb();
  },
  createAccount: function(options, cb) {
    var account = new Account(options);

    async.series([
      runCode.bind(this),
      storeCode.bind(this),
      saveStorage.bind(this),
      (function(cb) {
        this.vm.trie.put(options.address, account.serialize(), cb);
      }).bind(this)
    ], cb);

    function runCode(cb) {
      if (!options.hasOwnProperty('runCode')) return cb();
      if (!_.every(
        ['name', 'binary', 'abi'],
        options.runCode.hasOwnProperty.bind(options.runCode)
      )) return cb('Bad runCode field');
      
      var code = new Buffer(options.runCode.binary, 'hex');
      var from = new Buffer('1337133713371337133713371337133713371337', 'hex');
      this.createNextBlock([], (function(err, block) {
        if (err) return cb(err);
        this.vm.runCode({
          code: code,
          data: code,
          account: account,
          gasLimit: util.toBuffer(this.gasLimit),
          address: options.address,
          caller: from,
          block: block
        }, (function(err, result) {
          if (err) return cb(err);
          this.contracts['0x' + options.address.toString('hex')] = options.runCode;
          account.setCode(this.vm.trie, result.return, cb);
        }).bind(this));
      }).bind(this));
    }
    function storeCode(cb) {
      if (!options.hasOwnProperty('code')) cb();
      else account.setCode(this.vm.trie, options.code, cb);
    }
    function saveStorage(cb) {
      if (!options.hasOwnProperty('storage')) return cb();
      var strie = this.vm.trie.copy();
      strie.root = account.stateRoot;
      async.forEachOfSeries(
        options.storage,
        function(val, key, cb) {
          try {
            strie.put(
              createBuffer(key),
              rlp.encode(new Buffer(val, 'hex')),
              function(err) {
                account.stateRoot = strie.root;
                cb(err);
              }
            );
          } catch (e) {
            return cb('Could not parse storage entry: ' + e.message);
          }
        },
        cb
      );
    }
  },
  sendTx: function(options, cb) {
    if (!this.accounts.hasOwnProperty(options.from))
      return cb('Could not find a private key for ' + options.from);
    options.pkey = this.accounts[options.from];
    
    var tx = Object.create(Tx).init(options);

    check.call(this, tx, (function(err) {
      if (err) return cb(err);
      cb(null, util.toHex(tx.getTx().hash()));
      this.addPendingTx(tx);
    }).bind(this));

    function check(tx, cb) {
      this.vm.trie.get(util.toBuffer(tx.from), (function(err, data) {
        var account = new Account(data);

        cb(checkGasLimit.call(this) || checkBalance.call(this) || checkNonce.call(this));
        
        function checkGasLimit() {
          if (tx.gasLimit.greaterThan(this.gasLimit)) {
            return 'The transaction has gas limit ' + tx.gasLimit.toString() +
              ' which is greater than current block gas limit ' + tx.gasLimit.toString() + '.';
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
  },
  addPendingTx: function(tx) {
    _.each(this.filters, function(filter) {
      if (filter.type === 'pending')
        filter.entries.push(util.toHex(tx.getTx().hash()));
    });
    
    this.pendingTransactions.push(tx);
    this.runPendingTx();
  },
  runPendingTx: function() {
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
        this.blockchain.addBlock.bind(this.blockchain, block)
      ], (function(err, results) {
        var tx = this.pendingTransactions.shift();
        this.miningBlock = false;
        this.runPendingTx.call(this);
        if (err) console.error(err);
        else {
          var receipt = Object.create(Receipt)
              .init(tx, block, results[0].receipts[0], results[0].results[0]);
          this.receipts[util.toHex(tx.getTx().hash())] = receipt;
          
          if (tx.contract && receipt.contractAddress)
            this.contracts[receipt.contractAddress] = tx.contract;
          
          _.each(this.filters, function(filter) {
            if (filter.type === 'latest')
              filter.entries.push(util.toHex(block.hash()));
          });
        }
      }).bind(this));
    }).bind(this));
  },
  mineBlock: function() {
    if (this.miningBlock) return;
    this.miningBlock = true;
    this.createNextBlock([], (function(err, block) {
      if (err) {
        this.miningBlock = false;
        return console.error(err);
      }
      this.blockchain.addBlock(block, (function(err) {
        this.miningBlock = false;
        if (err) console.error(err);
        else {
          _.each(this.filters, function(filter) {
            if (filter.type === 'latest')
              filter.entries.push(util.toHex(block.hash()));
          });
        }
        this.runPendingTx();
      }).bind(this));
    }).bind(this));
  },
  call: function(options, cb) {
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
        
        var account = new Account(data);
        var prevTx = _.find(this.pendingTransactions, { from: tx.from });
        options.nonce = prevTx ? prevTx.nonce.plus(1) : util.toBigNumber(account.nonce);
        cb();
      }).bind(this));
    }
    function run(cb) {
      this.blockchain.getHead((function(err, block) {
        if (err) cb(err);
        else this.vm.copy().runTx({ tx: tx.getTx(), block: block }, cb);
      }).bind(this));
    }
  },
  getAccountAddresses: function(cb) {
    var stream = this.vm.trie.createReadStream();
    var accounts = [];
    stream.on('data', function(data) {
      accounts.push(util.toHex(data.key));
    });
    stream.on('end', function() {
      cb(null, accounts);
    });
  },
  getAccounts: function(cb) {
    var stream = this.vm.trie.createReadStream();
    var accounts = {};
    stream.on('data', function(data) {
      accounts[data.key.toString('hex')] = data.value;
    });
    stream.on('end', (function() {
      async.forEachOf(
        accounts,
        (function(rawAccount, address, cb) {
          this.parseAccount(rawAccount, function(err, account) {
            accounts[address] = account;
            cb(err);
          });
        }).bind(this),
        function(err) {
          cb(err, accounts);
        }
      );
    }).bind(this));
  },
  getAccount: function(address, cb) {
    try {
      var addressBuf = new Buffer(address, 'hex');
    } catch (e) {
      return cb('Could not parse address ' + address + ': ' + e.message);
    }
    this.vm.trie.get(addressBuf, (function(err, value) {
      if (err) cb(err);
      else this.parseAccount(value, cb);
    }).bind(this));
  },
  parseAccount: function(data, cb) {
    var raw = new Account(data);
    var account = {
      nonce: raw.nonce.toString('hex'),
      balance: raw.balance.toString('hex'),
      storage: {},
      code: ''
    };
    
    async.parallel([
      readStorage.bind(this, raw, account),
      readCode.bind(this, raw, account)
    ], function(err) {
      cb(err, account);
    });
    
    function readStorage(raw, account, cb) {
      if (raw.stateRoot.toString('hex') === this.SHA3_RLP_NULL) return cb();
      
      var strie = this.vm.trie.copy();
      strie.root = raw.stateRoot;
      var stream = strie.createReadStream();
      stream.on('data', function(data) {
        account.storage[data.key.toString('hex')] = createBuffer(rlp.decode(data.value)).toString('hex');
      });
      stream.on('end', cb);
    }
    function readCode(raw, account, cb) {
      raw.getCode(this.vm.trie, function(err, code) {
        account.code = code.toString('hex');
        cb(err);
      });
    }
  },
  newFilter: function(type, cb) {
    if (typeof type === 'object') cb(null, addFilter.call(this, 'log'));
    else if (type == 'pending') cb(null, addFilter.call(this, 'pending'));
    else if (type == 'latest') cb(null, addFilter.call(this, 'latest'));
    else cb('Unknow type: ' + type);

    function addFilter(type) {
      var num = '0x' + (this.filtersCounter++).toString(16);
      this.filters[num] = {
        type: type,
        entries: []
      };
      return num;
    }
  },
  removeFilter: function(id, cb) {
    if (!this.filters.hasOwnProperty(id))
      return cb('Could not find filter with id ' + id);
    delete this.filters[id];
    cb(null, true);
  },
  getFilterChanges: function(id, cb) {
    if (!this.filters.hasOwnProperty(id))
      return cb('Could not find filter with id ' + id);
    var changes = this.filters[id].entries;
    this.filters[id].entries = [];
    cb(null, changes);
  },
  createNextBlock: function(transactions, cb) {
    this.blockchain.getHead((function(err, lastBlock) {
      if (err) return cb(err);
      var block = new Block({
        header: {
          coinbase: this.coinbase,
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
  }
};

module.exports = Sandbox;

function createBuffer(str) {
  var msg = new Buffer(str, 'hex');
  var buf = new Buffer(32);
  buf.fill(0);
  msg.copy(buf, 32 - msg.length);
  return buf;
}

function fillWithZeroes(str, length, right) {
  if (str.length >= length) return str;
  var zeroes = _.repeat('0', length - str.length);
  return right ? str + zeroes : zeroes + str;
}

function sha3(str) {
  var sha = new SHA3Hash(256);
  sha.update(str);
  return sha.digest('hex');
}

function pad(str) {
  return str.length % 2 === 0 ? str : '0' + str;
}

function setField(target, source, name) {
  try {
    if (source.hasOwnProperty(name) && source[name]) {
      if (!/^[\dA-F]*$/i.test(source[name]))
        throw { message: 'Invalid hex string' };
      if (!/^0*$/.test(source[name]))
        target[name] = new Buffer(source[name], 'hex');
    }
  } catch (e) {
    throw 'Could not set field ' + name + ' to ' + source[name] + ': ' + e.message;
  }
}

function parseTx(tx, results) {
  return {
    from: tx.getSenderAddress().toString('hex'),
    nonce: ethUtils.bufferToInt(tx.nonce),
    gasPrice: ethUtils.bufferToInt(tx.gasPrice),
    gasLimit: ethUtils.bufferToInt(tx.gasLimit),
    to: tx.to.toString('hex'),
    gasUsed: results.gasUsed ? results.gasUsed.toString('hex') : '',
    value: ethUtils.bufferToInt(tx.value),
    data: tx.data.toString('hex'),
    createdAddress: results.createdAddress ? results.createdAddress.toString('hex') : '',
    returnValue: results.return ? results.return.toString('hex') : '',
    exception: results.exception || 1,
    rlp: tx.serialize().toString('hex'),
    r : tx.r.toString('hex'),
    s : tx.s.toString('hex'),
    v : tx.v.toString('hex'),
    hash: tx.hash().toString('hex')
  };
}
