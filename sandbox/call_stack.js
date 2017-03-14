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

    var call = _.last(contract.calls);
    var mapping = _.find(contract.obj.getActualSrcmap(), { pc: data.pc });

    if (mapping) {
      if (!call) {
        var func = contract.obj.details.findFunc(mapping);
        if (func) {
          call = {
            func: func,
            stackPointer: -1,
            mapping: null,
            activeModifier: -1,
            modifiers: _.map(func.modifiers, function(modifier) {
              return {
                modifier: modifier,
                stackPointer: -1
              };
            })
          };
          contract.calls.push(call);
        }
      } else if (call.func) {
        if (call.func.inBlock(mapping) && !call.func.isVarDeclaration(mapping)) {
          call.mapping = mapping;
          call.activeModifier = -1;
          calcStackPointers(call, data.stack.length);
        } else {
          call.mapping = null;
          call.activeModifier = call.func.findModifierIndex(mapping);
          if (call.activeModifier != -1) {
            call.mapping = mapping;
            calcStackPointers(call, data.stack.length);
          } else {
            func = contract.obj.details.findFunc(mapping);
            if (func && call.func.name != func.name) {
              call.func = func;
              call.stackPointer = -1;
              call.activeModifier = -1;
              call.modifiers = _.map(func.modifiers, function(modifier) {
                return {
                  modifier: modifier,
                  stackPointer: -1
                };
              });
              if (call.func.inBlock(mapping) && !call.func.isVarDeclaration(mapping)) {
                call.mapping = mapping;
                calcStackPointers(call, data.stack.length);
              }
            }
          }
        }
      }

      if (mapping.type == 'i') {
        call = {
          func: null,
          stackPointer: -1,
          mapping: null,
          activeModifier: -1,
          modifiers: []
        };
        var targetPc = _.last(data.stack).readUIntBE(0, 32);
        var targetMapping = _.find(contract.obj.getActualSrcmap(),
                                   { pc: targetPc });
        if (targetMapping) {
          call.func = contract.obj.details.findFunc(targetMapping);
          if (call.func) {
            call.modifiers = _.map(call.func.modifiers, function(modifier) {
              return {
                modifier: modifier,
                stackPointer: -1
              };
            });
          }
        }
        contract.calls.push(call);
      } else if (mapping.type == 'o') {
        contract.calls.pop();
        call = _.last(contract.calls);
        if (call) call.mapping = null;
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
          if (call.activeModifier == -1) {
            var method = call.func;
            var stackPointer = call.stackPointer;
          } else {
            method = call.modifiers[call.activeModifier].modifier;
            stackPointer = call.modifiers[call.activeModifier].stackPointer;
          }

          return {
            name: method ? method.name : contract.address,
            mapping: call.mapping,
            storage: storageVars,
            vars: method ?
              method.parseVariables(
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

function calcStackPointers(call, stackSize) {
  if (call.stackPointer != -1) return;
  if (call.activeModifier == -1) {
    call.stackPointer = stackSize - call.func.varsStackSize;
  } else {
    call.stackPointer = stackSize -
      call.func.getVarsOffsetForModifier(call.activeModifier);
  }
  var sp = call.stackPointer + call.func.ownVarsStackSize;
  for (var i = 0; i < call.modifiers.length; i++) {
    call.modifiers[i].stackPointer = sp;
    sp += call.modifiers[i].modifier.varsStackSize;
  }
}

module.exports = callStack;
