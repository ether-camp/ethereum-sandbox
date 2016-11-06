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
 
var _ = require('lodash');
var async = require('async');
var util = require('../util');

var Account = require('../ethereum/account');

module.exports = function(services) {
  var sandbox = services.sandbox;
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
            name: { type: 'string', defaultVal: null },
            balance: { type: 'number', defaultVal: null },
            nonce: { type: 'number', defaultVal: null },
            code: { type: 'hex', defaultVal: null },
            runCode: { type: 'contract', defaultVal: null },
            storage: {
              type: 'map',
              key: 'hex',
              defaultVal: null,
              values: { type: 'hex' }
            }
          }
        }
      }],
      handler: function(accounts, cb) {
        accounts = async.forEachOfSeries(accounts, sandbox.createAccount.bind(sandbox), cb);
      }
    },
    setBlock: {
      args: [{
        type: 'map',
        values: {
          coinbase: { type: 'address', defaultVal: null },
          difficulty: { type: 'number', defaultVal: null },
          gasPrice: { type: 'number', defaultVal: null },
          gasLimit: { type: 'number', defaultVal: null }
        }
      }],
      handler: function(options, cb) {
        if (options.coinbase) sandbox.coinbase = options.coinbase;
        if (options.difficulty) sandbox.difficulty = options.difficulty;
        if (options.gasPrice) sandbox.gasPrice = options.gasPrice;
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
            var address = util.toHex(data.key);
            var account = Object.create(Account).init(data.value, address);
            if (sandbox.accountNames.hasOwnProperty(address))
              account.name = sandbox.accountNames[address];
            
            accounts.push(account);
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
    }},
    gasLimit: {
      args: [],
      handler: function(cb) { cb(null, '0x' + sandbox.gasLimit.toString(16)); }
    },
    setProjectName: {
      args: [{ type: 'string' }],
      handler: function(name, cb) {
        sandbox.projectName = name;
        cb();
      }
    },
    projectName: {
      args: [],
      handler: function(cb) {
        cb(null, sandbox.projectName);
      }
    },
    setTimestamp: {
      args: [{ type: 'number' }, { type: 'bool', defaultVal: false }],
      handler: function(timestamp, keepTimestampConstant, cb) {
        sandbox.timeOffset = timestamp - Math.floor(Date.now() / 1000);
        sandbox.timestamp = timestamp;
        sandbox.keepTimestampConstant = keepTimestampConstant;
        cb();
      }
    },
    stopMiner: {
      args: [],
      handler: function(cb) {
        sandbox.stopMiner();
        cb();
      }
    },
    startMiner: {
      args: [],
      handler: function(cb) {
        sandbox.startMiner();
        cb();
      }
    },
    mine: {
      args: [{ type: 'number' }],
      handler: function(num, cb) {
        async.timesSeries(
          num.toNumber(),
          function (n, cb) {
            sandbox.mineBlock(false, cb);
          },
          function(err) {
            if (err) console.error(err);
          }
        );
        cb();
      }
    }
  };
};
