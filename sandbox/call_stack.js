var _ = require('lodash');
var ethUtil = require('ethereumjs-util');
var async = require('async');
var Account = require('../ethereum/account');

var callStack = {
  state: 'waitingForCall',
  contractsStack: [],

  init: function(contracts, hashDict) {
    this.contracts = contracts;
    this.hashDict = hashDict;
    return this;
  },
  clean: function() {
    this.state = 'waitingForCall',
    this.contractsStack = [];
  },
  trace: function(data) {
    var contract;
    
    if (data.depth > this.contractsStack.length - 1) {
      var address = this.state == 'waitingForLibCall' ?
          this.libraryAddress :
          '0x' + data.address.toString('hex');
      contract = {
        address: address,
        baseAddress: '0x' + data.address.toString('hex'),
        stack: data.stack,
        memory: data.memory,
        account: data.account,
        calls: []
      };
      this.contractsStack.push(contract);
      this.state = 'waitingForCall';
    } else if (data.depth < this.contractsStack.length - 1) {
      this.contractsStack.pop();
      contract = _.last(this.contractsStack);
    } else {
      contract = _.last(this.contractsStack);
    }

    if (contract && contract.calls.length == 1 &&
        _.last(contract.calls).func && _.last(contract.calls).func.constructor) {
      contract.calls = [];
      this.state = 'waitingForCall';
    }

    var call;
    if (_.has(this.contracts, contract.address) &&
        this.contracts[contract.address].srcmap &&
        this.contracts[contract.address].details) {
      contract.obj = this.contracts[contract.address];
      var srcmap = contract.obj.deployed ?
          contract.obj.srcmapRuntime :
          contract.obj.srcmap;
      var mapping = _.find(srcmap, { pc: data.pc });
      if (mapping) {
        if (this.state == 'waitingForCall') {
          var func = contract.obj.details.getFunc(mapping);
          if (func) {
            var stackPointer = func.constructor ? 0 : 2;
            if (contract.calls.length > 0) {
              var prev = _.last(contract.calls);
              stackPointer = prev.stackPointer + prev.func.variables.length + 1;
            }
            call = {
              func: func,
              stackPointer: stackPointer
            };
            contract.calls.push(call);
            this.state = 'running';
          }
        }
        if (this.state == 'running') {
          call = _.last(contract.calls);
          if (call) {
            if (call.func.inBlock(mapping) && !call.func.isVarDeclaration(mapping)) {
              call.modifier = null;
              call.mapping = mapping;
            } else {
              var modifier = call.func.getModifier(mapping);
              if (modifier) {
                call.modifier = {
                  modifier: modifier.modifier,
                  stackPointer: call.stackPointer + modifier.stackOffset
                };
                call.mapping = mapping;
              } else {
                call.mapping = null;
              }
            }
          }
        }
        
        if (mapping.type == 'i') {
          this.state = 'waitingForCall';
        } else if (mapping.type == 'o') {
          contract.calls.pop();
          call = _.last(contract.calls);
          if (call) call.mapping = null;
        }
      }
    }

    if (data.opcode.name == 'DELEGATECALL') {
      this.libraryAddress = '0x' + data.stack[data.stack.length - 2].toString('hex', 12);
      this.state = 'waitingForLibCall';
    }

    return call;
  },
  details: function(trie, cb) {
    var self = this;
    async.map(this.contractsStack, function(contract, cb) {
      var account = Object.create(Account).init(contract.account);
      account.readStorage1(trie, function(err, storage) {
        if (err) return cb(err);

        var storageVars = [];
        if (_.has(self.contracts, contract.baseAddress)) {
          storageVars = self.contracts[contract.baseAddress].details
            .getStorageVars(storage, self.hashDict);
        }
        cb(null, _.map(contract.calls, function(call, idx) {
          var func = call.func;
          var stackPointer = call.stackPointer;
          if (call.modifier) {
            func = call.modifier.modifier;
            stackPointer = call.modifier.stackPointer;
          }

          return {
            name: func ? func.name : contract.address,
            mapping: call.mapping,
            storage: storageVars,
            vars: func ?
              func.parseVariables(
                stackPointer, contract.stack,
                contract.memory, storage, self.hashDict
              ) :
              []
          };
        }));
      });
    }, function(err, callStack) {
      if (err) cb(err);
      cb(null, _.flatten(callStack));
    });
  }
};

module.exports = callStack;
