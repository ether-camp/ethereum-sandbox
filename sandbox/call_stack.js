var _ = require('lodash');
var ethUtil = require('ethereumjs-util');

var callStack = {
  // empty, variablesDefinition, running
  state: 'empty',
  calls: [],

  init: function(contracts) {
    this.contracts = contracts;
    return this;
  },
  clean: function() {
    this.state = 'empty',
    this.calls = [];
  },
  trace: function(data) {
    var address;
    if (this.state == 'empty' || this.state == 'waitingForCall') {
      address = '0x' + data.address.toString('hex');
    } else if (this.state == 'waitingForLibCall') {
      address = this.libraryAddress;
    } else {
      var call = _.last(this.calls);
      if (call) address = _.last(this.calls).address;
      else address = '0x' + data.address.toString('hex');
    }

    if (this.contracts.hasOwnProperty(address) &&
        this.contracts[address].srcmap &&
        this.contracts[address].details) {
      var contract = this.contracts[address];
      var srcmap = contract.deployed ? contract.srcmapRuntime : contract.srcmap;
      var mapping = _.find(srcmap, { pc: data.pc });
      if (mapping) {
        var func = contract.details.getFunc(mapping);
        if (func) {
          var inBlock = func.inBlock(mapping);
          if (this.state == 'outOfBlock' && inBlock &&
              data.opcode.name != 'PUSH1') {
            this.state = 'running';
          }

          if (this.state == 'waitingForReturn' && inBlock) {
            this.calls.pop();
            this.state = this.calls.length == 0 ? 'empty' : 'running';
          }

          if (this.state == 'empty') {
            this.calls.push({
              address: address,
              contract: contract,
              func: func
            });
            this.state = 'outOfBlock';
          } else if (this.state == 'running') {
            _.last(this.calls).mapping = inBlock ? mapping : null;
          } else if (this.state == 'waitingForCall') {
            this.calls.push({
              address: address,
              contract: contract,
              func: func
            });
            this.state = 'outOfBlock';
          } else if (this.state == 'waitingForLibCall') {
            var baseAddress = '0x' + data.address.toString('hex');
            this.calls.push({
              address: address,
              contract: this.contracts.hasOwnProperty(baseAddress) ?
                this.contracts[baseAddress] : null,
              func: func
            });
            this.state = 'outOfBlock';
          }
        }

        if (mapping.type == 'i') this.state = 'waitingForCall';
        else if (mapping.type == 'o') {
          this.state = 'waitingForReturn';
          _.last(this.calls).mapping = null;
        }
      }
    } else {
      if (this.state == 'waitingForCall' || this.state == 'waitingForLibCall') {
        this.calls.push({
          address: address,
          contract: null,
          func: null
        });
        this.state = 'running';
      }
    }

    if (data.opcode.name == 'CREATE' ||
        (data.opcode.name == 'CALL' &&
         !ethUtil.isPrecompiled(data.stack[data.stack.length - 2]))) {
      this.state = 'waitingForCall';
    } else if (data.opcode.name == 'DELEGATECALL') {
      this.libraryAddress = '0x' + data.stack[data.stack.length - 2].toString('hex');
      this.state = 'waitingForLibCall';
    } else if ((data.opcode.name == 'STOP' || data.opcode.name == 'RETURN') &&
               (!mapping || this.state == 'waitingForReturn')) {
      this.calls.pop();
      this.state = this.calls.length == 0 ? 'empty' : 'running';
    }

    return _.last(this.calls);
  },
  details: function(stack, memory, storage, hashDict) {
    var stackPointer = 2;
    return _.map(this.calls, function(call) {
      var details = {
        name: call.func ? call.func.name : call.address,
        mapping: call.mapping,
        vars: call.func ?
          call.func.parseVariables(stackPointer, stack, memory, storage, hashDict) : []
      };
      stackPointer += details.vars.length + 1;
      return details;
    });
  }
};

module.exports = callStack;
