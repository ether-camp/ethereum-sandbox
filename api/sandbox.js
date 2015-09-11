var _ = require('lodash');
var async = require('async');
var util = require('../util');

var Account = require('../ethereum/account');

module.exports = function(sandbox) {
  return {
    id: { args: [], handler: function(cb) {
      cb(null, sandbox.id);
    }},
    addAccounts: {
      args: [{
        type: 'map',
        key: 'address',
        values: {
          type: 'map',
          values: {
            pkey: { type: 'hex64' },
            'default': { type: 'bool', defaultVal: false }
          }
        }
      }],
      handler: function(accounts, cb) {
        if (_(accounts).where({ 'default': true }) > 1) {
          cb('Only one account can be default');
        } else {
          _.each(accounts, function(details, address) {
            sandbox.accounts[address] = details.pkey;
          });
          var defaultAccount = _.findKey(accounts, { 'default': true });
          if (defaultAccount) sandbox.defaultAccount = defaultAccount;
          else if (!sandbox.defaultAccount) sandbox.defaultAccount = _.keys(accounts)[0];
          cb();
        }
      }
    },
    createAccounts: {
      args: [{
          type: 'map',
          key: 'address',
          values: {
            type: 'map',
            values: {
              balance: { type: 'number', defaultVal: null },
              nonce: { type: 'number', defaultVal: null },
              code: { type: 'hex', defaultVal: null },
              runCode: { type: 'contract', defaultVal: null },
              storage: {
              type: 'map',
              key: 'hex64',
              defaultVal: null,
              values: { type: 'hex64' }
            }
          }
        }
      }],
      handler: function(accounts, cb) {
        accounts = _.map(accounts, function(details, address) {
          return Object.create(Account).init(details, address);
        });
        async.eachSeries(accounts, sandbox.createAccount.bind(sandbox), cb);
      }
    },
    setBlock: {
      args: [{
        type: 'map',
        values: {
          coinbase: { type: 'address', defaultVal: null },
          difficulty: { type: 'number', defaultVal: null },
          gasLimit: { type: 'number', defaultVal: null }
        }
      }],
      handler: function(options, cb) {
        if (options.coinbase) sandbox.coinbase = options.coinbase;
        if (options.difficulty) sandbox.difficulty = options.difficulty;
        if (options.gasLimit) sandbox.gasLimit = options.gasLimit;
        cb();
      }
    },
    defaultAccount: { args: [], handler: function(cb) {
      cb(null, sandbox.defaultAccount);
    }},
    accounts: {
      args: [{ type: 'bool', defaultVal: false }],
      handler: function(full, cb) {
        if (full) {
          var stream = sandbox.vm.trie.createReadStream();
          var accounts = [];
          stream.on('data', function(data) {
            accounts.push(Object.create(Account).init(data.value, util.toHex(data.key)));
          });
          stream.on('end', function() {
            async.each(accounts, function(account, cb) {
              async.parallel([
                account.readStorage.bind(account, sandbox.vm.trie),
                account.readCode.bind(account, sandbox.vm.trie),
              ], cb);
            }, function(err) {
              if (err) return cb(err);
              cb(null, _.reduce(accounts, function(result, account) {
                result[account.address] = account.getDetails();
                return result;
              }, {}));
            });
          });
        } else {
          var stream = sandbox.vm.trie.createReadStream();
          var accounts = [];
          stream.on('data', function(data) {
            accounts.push(util.toHex(data.key));
          });
          stream.on('end', function() {
            cb(null, accounts);
          });
        }
      }
    },
    transactions: { args: [], handler: function(cb) {
      cb(null, _.invoke(sandbox.receipts, 'getDetails'));
    }},
    receipt: {
      args: [{ type: 'hex64' }],
      handler: function(txHash, cb) {
        cb(null, sandbox.receipts.hasOwnProperty(txHash) ?
           sandbox.receipts[txHash].getDetails() : null);
      }
    },
    contracts: { args: [], handler: function(cb) {
      cb(null, sandbox.contracts);
    }}
  };
};
