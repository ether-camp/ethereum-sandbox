var _ = require('lodash');
var Account = require('../ethereum/account');
var CallStack = require('./call_stack');
var Tracer = require('./tracer');

var Debugger = {
  init: function(ethVm, sandbox, hashDict) {
    var self = this;
    this.ethVm = ethVm;
    this.sandbox = sandbox;
    this.resumeCb = null;
    this.callStack = Object.create(CallStack)
      .init(this.sandbox.contracts, hashDict);
    this.tracer = Object.create(Tracer).init(sandbox.breakpoints.array);
    this.ethVm.on('beforeTx', function(tx) {
      self.setCallData(tx.data);
    });
    this.ethVm.on('afterTx', this.finish.bind(this));
    this.ethVm.on('step', this.trace.bind(this));

    return this;
  },
  trace: function(data, cb) {

    var self = this;
    var call = this.callStack.trace(data);
    if (!call || !call.mapping) return cb();

    var bp = this.tracer.trace(call.mapping, this.callStack);
    if (!bp) return cb();

    this.resumeCb = cb;

    this.callStack.details(this.ethVm.trie, function(err, callStack) {
      self.sandbox.filters.newBreakpoint(bp, callStack);
    });
  },
  setCallData: function(calldata) {
    this.callStack.calldata = calldata;
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
      this.tracer.stepOverStackLevel =
        this.tracer.calcStackDepth(this.callStack.contractsStack);
      this.resumeCb();
      this.resumeCb = null;
    }
  },
  stepOut: function() {
    if (this.resumeCb) {
      this.tracer.state = 'stepOut';
      this.tracer.stepOutStackLevel =
        this.tracer.calcStackDepth(this.callStack.contractsStack);
      this.resumeCb();
      this.resumeCb = null;
    }
  },
  finish: function() {
    this.callStack.clean();
    this.tracer.clean();
  },
  destroy: function() {
    this.sandbox = null;
    this.prevBreakpoint = null;
    this.resumeCb = null;
    this.ethVm = null;
  }
};

function equals(position1, position2) {
  return position1.line == position2.line &&
    position1.source == position2.source;
}

module.exports = Debugger;
