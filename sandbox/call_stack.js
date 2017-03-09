var _ = require('lodash');
var ethUtil = require('ethereumjs-util');
var async = require('async');
var Account = require('../ethereum/account');

var callStack = {
  init: function(contracts, hashDict) {
    this.contracts = contracts;
    this.hashDict = hashDict;
    this.contractsStack = [];
    this.calldata = null;
    this.state = 'noContract';
    return this;
  },
  clean: function() {
    this.state = 'noContract',
    this.contractsStack = [];
  },
  trace: function(data) {
    return this._updateCall(this._updateContract(data), data);
  },
  _updateContract: function(data) {
    var contract;
    if (this.contractsStack.length == 0) {
      var address = '0x' + data.address.toString('hex');
      contract = {
        address: address,
        baseAddress: address,
        stack: data.stack,
        memory: data.memory,
        account: data.account,
        obj: _.has(this.contracts, address) ? this.contracts[address] : null,
        calls: []
      };
      this.contractsStack.push(contract);
    } else {
      contract = _.last(this.contractsStack);
      contract.stack = data.stack,
      contract.memory = data.memory,
      contract.account = data.account;
      if (!_.has(contract, 'obj')) {
        contract.obj = _.has(this.contracts, contract.address) ?
          this.contracts[contract.address] : null;
      }
    }
    return contract;
  },
  _updateCall: function(contract, data) {
    if (!contract.obj || !contract.obj.srcmap || !contract.obj.details)
      return null;

    var call;
    var mapping = _.find(contract.obj.getActualSrcmap(), { pc: data.pc });

    if (mapping) {
      if (contract.calls.length == 0) {
        if (data.opcode.name == 'JUMPDEST') {
          var func = contract.obj.details.getFunc(mapping);
          if (func) {
            call = {
              func: func,
              modifier: null,
              stackPointer: null,
              mapping: null
            };
            contract.calls.push(call);
          }
        }
      } else {
        call = _.last(contract.calls);
        call.mapping = null;
        if (call.func) {
          if (call.func.inBlock(mapping) &&
              !call.func.isVarDeclaration(mapping)) {
            call.modifier = null;
            call.mapping = mapping;
            if (call.stackPointer == null)
              call.stackPointer = data.stack.length - call.func.varsStackSize;
          } else {
            var modifier = call.func.getModifier(mapping);
            if (modifier) {
              if (!call.modifier ||
                  call.modifier.modifier.name != modifier.modifier.name) {
                call.modifier = {
                  modifier: modifier.modifier,
                  stackPointer: data.stack.length - modifier.modifier.varsStackSize
                };
              }
              
              if (call.stackPointer == null)
                call.stackPointer = data.stack.length - modifier.modifier.varsStackSize - modifier.stackOffset;
              
              call.mapping = mapping;
            } else {
              call.mapping = null;
            }
          }
        }

        if (mapping.type == 'i') {
          call = {
            func: null,
            stackPointer: null,
            mapping: null
          };
          var targetPc = _.last(data.stack).readUIntBE(0, 32);
          var targetMapping = _.find(contract.obj.getActualSrcmap(),
                                     { pc: targetPc });
          if (targetMapping) {
            func = contract.obj.details.getFunc(targetMapping);
            if (func) call.func = func;
          }
          contract.calls.push(call);
        } else if (mapping.type == 'o') {
          contract.calls.pop();
          call = _.last(contract.calls);
          if (call) call.mapping = null;
        }
      }
    }

    if (data.opcode.name == 'CALL') {
      var address = '0x' + data.stack[data.stack.length - 2].toString('hex', 12);
      this.contractsStack.push({
        address: address,
        baseAddress: address,
        calls: []
      });
      call = null;
    } else if (data.opcode.name == 'DELEGATECALL') {
      address = '0x' + data.stack[data.stack.length - 2].toString('hex', 12);
      this.contractsStack.push({
        address: address,
        baseAddress: contract.address,
        calls: []
      });
      call = null;
    } else if (data.opcode.name == 'STOP' || data.opcode.name == 'RETURN') {
      this.contractsStack.pop();
      call = null;
    };
    
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
                stackPointer, self.calldata, contract.stack,
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
