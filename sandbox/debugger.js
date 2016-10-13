var _ = require('lodash');
var Account = require('../ethereum/account');

var Debugger = {
  init: function(sandbox) {
    var self = this;
    this.sandbox = sandbox;
    this.breakpoints = [];
    this.prevBreakpoint = null;
    this.resumeCb = null;
    this.callStack = [];
    this.waitingForCall = false;
    this.waitingForReturn = false;
    this.variablesDefinition = false;
    this.inStepInto = false;
    this.inStepOver = false;
    this.stepOverStackLevel = 0;
    this.inStepOut = false;
    this.stepOutStackLevel = 0;
    sandbox.vm.on('afterTx', function() {
      self.callStack = [];
      self.waitingForCall = false;
      self.waitingForReturn = false;
      self.variablesDefinition = false;
    });
    sandbox.vm.on('step', this.trace.bind(this));
    
    return this;
  },
  trace: function(data, cb) {
    var self = this;
    var address = '0x' + data.address.toString('hex');
    if (address in self.sandbox.contracts) {
      var contract = self.sandbox.contracts[address];
      var srcmap = contract.deployed ? contract.srcmapRuntime : contract.srcmap;
      var mapping = _.find(srcmap, { pc: data.pc });
      var bp = null;
      if (mapping) {
        if (this.callStack.length == 0) {
          var func = contract.details.getFunc(mapping);
          if (func) {
            this.callStack.push({ name: func.name });
            this.variablesDefinition = true;
          }
        } else if (mapping.type == 'i') {
          this.waitingForCall = true;
        } else if (mapping.type == 'o') {
          this.waitingForReturn = true;
        } else if (this.waitingForCall) {
          func = contract.details.getFunc(mapping);
          this.callStack.push({ name: func.name });
          this.waitingForCall = false;
        } else if (this.waitingForReturn) {
          this.callStack.pop();
          this.waitingForReturn = false;
        }

        if (this.variablesDefinition) {
          if (data.opcode.name != 'PUSH1') this.variablesDefinition = false;
          else return cb();
        }

        if (this.callStack.length > 0) {
          var entry = _.last(this.callStack);
          entry.source = contract.sourceList[mapping.source];
          entry.line = mapping.line;
        }

        if (!this.prevBreakpoint ||
            !(this.prevBreakpoint.source == contract.sourceList[mapping.source] &&
              this.prevBreakpoint.line == mapping.line)) {
          if (this.inStepInto) {
            bp = {
              line: mapping.line,
              source: contract.sourceList[mapping.source]
            };
            this.prevBreakpoint = bp;
            this.inStepInto = false;
          } else if (this.inStepOver) {
            if (this.callStack.length <= this.stepOverStackLevel) {
              bp = {
                line: mapping.line,
                source: contract.sourceList[mapping.source]
              };
              this.prevBreakpoint = bp;
              this.inStepOver = false;
            }
          } else if (this.inStepOut) {
            if (this.callStack.length < this.stepOutStackLevel) {
              bp = {
                source: contract.sourceList[mapping.source],
                line: mapping.line
              };
              this.prevBreakpoint = bp;
              this.inStepOut = false;
            }
          } else {
            bp = _.find(this.breakpoints, {
              source: contract.sourceList[mapping.source],
              line: mapping.line
            });
            this.prevBreakpoint = bp;
          }
        }
      } else this.prevBreakpoint = null;
    } else this.prevBreakpoint = null;

    if (!bp) return cb();

    var account = Object.create(Account).init(data.account);
    account.readStorage1(self.sandbox.vm.trie, function(err, storage) {
      if (err) {
        console.error(err);
        return cb();
      }

      var func = contract.details.getFunc(mapping);
      
      var vars = {
        storage: contract.details.getStorageVars(storage, self.sandbox.hashDict),
        func: func ? func.parseVariables(data.stack, data.memory) : []
      };

      self.sandbox.filters.newBreakpoint(bp, self.callStack, vars);
      self.resumeCb = cb;
      console.log('paused');
    });
  },
  addBreakpoint: function(bp) {
    bp = {
      line: bp.line.toNumber(),
      source: bp.source
    };
    if (!_.contains(this.breakpoints, bp)) {
      this.breakpoints.push(bp);
    }
  },
  removeBreakpoint: function(bp) {
    bp = {
      line: bp.line.toNumber(),
      source: bp.source
    };
    _.remove(this.breakpoints, bp);
  },
  resume: function() {
    if (this.resumeCb) {
      this.resumeCb();
      this.resumeCb = null;
    }
  },
  stepInto: function() {
    if (this.resumeCb) {
      this.inStepInto = true;
      this.resumeCb();
      this.resumeCb = null;
    }
  },
  stepOver: function() {
    if (this.resumeCb) {
      this.inStepOver = true;
      this.stepOverStackLevel = this.callStack.length;
      this.resumeCb();
      this.resumeCb = null;
    }
  },
  stepOut: function() {
    if (this.resumeCb) {
      this.inStepOut = true;
      this.stepOutStackLevel = this.callStack.length;
      this.resumeCb();
      this.resumeCb = null;
    }
  },
  clear: function() {
    this.sandbox = null;
    this.prevBreakpoint = null;
    this.resumeCb = null;
  }
};

function equals(position1, position2) {
  return position1.line == position2.line &&
    position1.source == position2.source;
}

module.exports = Debugger;
