var _ = require('lodash');
var Account = require('../ethereum/account');
var CallStack = require('./call_stack');
var Tracer = require('./tracer');

var Debugger = {
  init: function(sandbox) {
    var self = this;
    this.sandbox = sandbox;
    this.resumeCb = null;
    this.callStack = Object.create(CallStack).init(this.sandbox.contracts);
    this.tracer = Object.create(Tracer).init();
    sandbox.vm.on('afterTx', function() {
      self.callStack.clean();
      self.tracer.clean();
    });
    sandbox.vm.on('step', this.trace.bind(this));
    
    return this;
  },
  trace: function(data, cb) {
    var self = this;
    var call = this.callStack.trace(data);
    if (!call || !call.mapping) return cb();

    var bp = this.tracer.trace(call.mapping, this.callStack);
    console.log(bp);
    if (!bp) return cb();

    this.resumeCb = cb;

    var account = Object.create(Account).init(data.account);
    account.readStorage1(self.sandbox.vm.trie, function(err, storage) {
      if (err) {
        console.error(err);
        return cb();
      }
      
      var callStack = self.callStack.details(data.stack, data.memory, storage, self.sandbox.hashDict);
      var storageVars = call.contract ?
          call.contract.details.getStorageVars(storage, self.sandbox.hashDict) : [];
      self.sandbox.filters.newBreakpoint(bp, callStack, storageVars);
    });
  },
  addBreakpoint: function(bp) {
    this.tracer.addBreakpoint(bp);
  },
  removeBreakpoint: function(bp) {
    this.tracer.removeBreakpoint(bp);
  },
  resume: function() {
    if (this.resumeCb) {
      this.resumeCb();
      this.resumeCb = null;
    }
  },
  stepInto: function() {
    if (this.resumeCb) {
      this.tracer.state = 'stepInto';
      this.resumeCb();
      this.resumeCb = null;
    }
  },
  stepOver: function() {
    if (this.resumeCb) {
      this.tracer.state = 'stepOver';
      this.tracer.stepOverStackLevel = this.callStack.calls.length;
      this.resumeCb();
      this.resumeCb = null;
    }
  },
  stepOut: function() {
    if (this.resumeCb) {
      this.tracer.state = 'stepOut';
      this.tracer.stepOutStackLevel = this.callStack.calls.length;
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
