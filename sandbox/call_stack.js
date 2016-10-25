var _ = require('lodash');

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
      address = _.last(this.calls).address;
    }

    if (this.contracts.hasOwnProperty(address)) {
      var contract = this.contracts[address];
      var srcmap = contract.deployed ? contract.srcmapRuntime : contract.srcmap;
      var mapping = _.find(srcmap, { pc: data.pc });
      if (mapping) {
        var func = contract.details.getFunc(mapping);
        if (func) {
          if (this.state == 'variablesDefinition') {
            if (data.opcode.name != 'PUSH1') this.state = 'running';
          }
          
          if (this.state == 'empty') {
            this.calls.push({
              address: address,
              contract: contract,
              func: func
            });
            this.state = data.opcode.name == 'PUSH1' ?
              'running' : 'variablesDefinition';
          } else if (this.state == 'running') {
            _.last(this.calls).mapping = mapping;
          } else if (this.state == 'waitingForCall') {
            this.calls.push({
              address: address,
              contract: contract,
              func: func
            });
            this.state = data.opcode.name == 'PUSH1' ?
              'running' : 'variablesDefinition';
          } else if (this.state == 'waitingForLibCall') {
            var baseAddress = '0x' + data.address.toString('hex');
            this.calls.push({
              address: address,
              contract: this.contracts.hasOwnProperty(baseAddress) ?
                this.contracts[baseAddress] : null,
              func: func
            });
            this.state = data.opcode.name == 'PUSH1' ?
              'running' : 'variablesDefinition';
          } else if (this.state == 'waitingForReturn') {
            this.calls.pop();
            var call = _.last(this.calls);
            if (call) call.mapping = mapping;
            this.state = 'running';
          }
        }

        if (mapping.type == 'i') this.state = 'waitingForCall';
        else if (mapping.type == 'o') this.state = 'waitingForReturn';
      }

      if (data.opcode.name == 'CALL') this.state = 'waitingForCall';
      else if (data.opcode.name == 'DELEGATECALL') {
        this.libraryAddress = '0x' + data.stack[data.stack.length - 2].toString('hex');
        this.state = 'waitingForLibCall';
      } else if (data.opcode.name == 'STOP' || data.opcode.name == 'RETURN') {
        this.calls.pop();
        this.state = this.calls.length == 0 ? 'empty' : 'running';
      }
    }
    return _.last(this.calls);
  },
  details: function(stack, memory, storage, hashDict) {
    var stackPointer = 2;
    return _.map(this.calls, function(call) {
      var details = {
        name: call.func.name,
        mapping: call.mapping,
        vars: call.func.parseVariables(stackPointer, stack, memory, storage, hashDict)
      };
      stackPointer += details.vars.length + 1;
      return details;
    });
  }
};

module.exports = callStack;
