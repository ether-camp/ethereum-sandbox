var Ethereum = require('ethereumjs-lib');
var Transaction = Ethereum.Transaction;
var rlp = Ethereum.rlp;
var utils = Ethereum.utils;
var async = require('async');
var SHA3Hash = require('sha3').SHA3Hash;
var _ = require('lodash');
var levelup = require('levelup');

var Sandbox = {
  SHA3_RLP_NULL: '56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421',

  init: function() {
    this.state = 'CLEAN';
    this.defaultAccount = null;
    this.transactions = [];
    return this;
  },
  createVM: function(block) {
    var blockDB = levelup('', { db: require('memdown') });
    var detailsDB = levelup('/does/not/matter', { db: require('memdown') });

    this.blockchain = new Ethereum.Blockchain(blockDB, detailsDB);
    this.blockchain.getBlockByNumber = function(number, cb) {
      cb(null, { hash: function() { return new Buffer(sha3(number), 'hex'); } });
    };

    this.vm = new Ethereum.VM(new Ethereum.Trie(), this.blockchain);
    
    this.block = new Ethereum.Block();
    if (block) {
      _.each([ 'coinbase', 'difficulty', 'gasLimit', 'number', 'timestamp' ],
             _.partial(setField, this.block.header, block));
    }
    
    this.vm.onStep = (function(info, done) {
      if (info.opcode === 'LOG') sendLog.call(this, info);
      done();
    }).bind(this);
    
    function sendLog(info) {
      var stack = info.stack.slice();
      info.account.getCode(this.vm.trie, function(err, code) {
        if (code.length !== 0) {
          var topicNum = code.readUInt8(info.pc) - 0xa0;
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
            return stack.pop().toString('hex');
          });
          client.emit('data', {
            address: info.address.toString('hex'),
            topics: topics,
            data: data
          });
        }
      });
    }
  },
  start: function(env, cb) {
    if (this.state !== 'CLEAN')
      return cb('Could not start sandbox with state ' + this.state);

    try {
      if (!this.vm) this.createVM(env.block);
    } catch (e) {
      return this.stop(cb.bind(null, e));
    }

    this.env = _(env.accounts).map(function(account, address) {
      return {
        address: address,
        pkey: account.hasOwnProperty('pkey') ? account.pkey : null,
        nonce: account.hasOwnProperty('nonce') ? parseInt(account.nonce, 16) : 0
      };
    }).indexBy('address').value();

    async.forEachOfSeries(env.accounts, processAccount.bind(this), (function(err) {
      if (err) this.stop(cb.bind(null, 'Could not create an account: ' + err));
      else {
        if (this.defaultAccount === null) {
          this.stop(cb.bind(null, 'Please, specify a default account in ethereum.json'));
        } else {
          this.state = 'ACTIVE';
          cb();
        }
      }
    }).bind(this));

    function processAccount(options, address, cb) {
      if (options.default) {
        if (this.defaultAccount !== null)
          return cb('There is should be only one default account. Please, correct ethereum.json.');
        
        if (!options.hasOwnProperty('pkey'))
          return cb('Default account in ethereum.json should have a pkey.');
        
        this.defaultAccount = address;
      }
      this.createAccount(address, options, cb);
    }
  },
  stop: function(cb) {
    this.vm = null;
    this.blockchain = null;
    this.block = null;
    this.defaultAccount = null;
    this.transactions = [];
    this.contracts = {};
    this.env = {};
    this.state = 'CLEAN';
    cb();
  },
  createAccount: function(address, options, cb) {
    var account = new Ethereum.Account();

    try {
      address = new Buffer(address, 'hex');
    } catch (e) {
      return cb('Could not parse account address ' + address + ': ' + e.message);
    }
    
    try {
      _.each(['balance', 'nonce'], _.partial(setField, account, options));
    } catch (e) {
      return cb(e);
    }

    async.series([
      runCode.bind(this),
      storeCode.bind(this),
      saveStorage.bind(this),
      (function(cb) {
        this.vm.trie.put(address, account.serialize(), cb);
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
      this.vm.runCode({
        code: code,
        data: code,
        account: account,
        gasLimit: 1000000,
        address: from,
        caller: from,
        block: this.block
      }, (function(err, result) {
        if (err) return cb(err);
        this.contracts[address.toString('hex')] = options.runCode;
        account.storeCode(this.vm.trie, result.returnValue, cb);
      }).bind(this));
    }
    function storeCode(cb) {
      if (!options.hasOwnProperty('code')) return cb();
      try {
        account.storeCode(this.vm.trie, new Buffer(options.code, 'hex'), cb);
      } catch (e) {
        cb('Could not parse code: ' + e);
      }
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
  createTx: function(options) {
    var tx = new Transaction();
    _.each(['nonce', 'to', 'gasLimit', 'gasPrice', 'value', 'data'],
           _.partial(setField, tx, options));

    if (!options.hasOwnProperty('gasPrice')) tx.gasPrice = 100000;
    if (!options.hasOwnProperty('gasLimit')) tx.gasLimit = 1000000;
    
    tx.sign(new Buffer(options.pkey, 'hex'));
    return tx;
  },
  runTx: function(options, cb) {
    var account = this.env[options.from];
    if (!account) return cb('Could not find an account with the address ' + options.from);
    if (!options.hasOwnProperty('pkey')) {
      if (!account.hasOwnProperty('pkey'))
        return cb('Please, specify the private key for account ' + options.from);
      options.pkey = account.pkey;
    }
    options.nonce = pad(account.nonce.toString(16));
    try {
      var tx = this.createTx(options);
    } catch (e) {
      return cb(e);
    }
    
    this.vm.runTx({ tx: tx, block: this.block }, (function(err, results) {
      if (err) return cb(err);
      account.nonce++;
      this.transactions.push(parseTransaction(tx, results));
      if (options.contract) {
        this.contracts[results.createdAddress.toString('hex')] = options.contract;
      }
      cb(null, {
        returnValue: results.vm.returnValue ?
          results.vm.returnValue.toString('hex') : null
      });
    }).bind(this));
    
    function parseTransaction(tx, results) {
      return {
        from: tx.getSenderAddress().toString('hex'),
        nonce: utils.bufferToInt(tx.nonce),
        gasPrice: utils.bufferToInt(tx.gasPrice),
        gasLimit: utils.bufferToInt(tx.gasLimit),
        to: tx.to.toString('hex'),
        gasUsed: results.gasUsed.toString('hex'),
        value: utils.bufferToInt(tx.value),
        data: tx.data.toString('hex'),
        createdAddress: results.createdAddress ? results.createdAddress.toString('hex') : '',
        returnValue: results.returnValue ? results.returnValue.toString('hex') : '',
        exception: results.exception,
        rlp: tx.serialize().toString('hex'),
        r : tx.r.toString('hex'),
        s : tx.s.toString('hex'),
        v : tx.v.toString('hex'),
        hash: tx.hash().toString('hex')
      };
    }
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
    var raw = new Ethereum.Account(data);
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
