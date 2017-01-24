var _ = require('lodash');

var Tracer = {
  breakpoints: [],
  prevBp: null,
  state: 'running', // running, stepInto, stepOver, stepOut
  init: function() {
    return this;
  },
  clean: function() {
    this.prevBp = null;
    this.state = 'running';
  },
  trace: function(mapping, callStack) {
    var bp = null;
    if (!this.prevBp ||
        !(this.prevBp.source == mapping.path &&
          this.prevBp.line == mapping.line)) {
      if (this.state == 'stepInto') {
        bp = {
          line: mapping.line,
          source: mapping.path
        };
      } else if (this.state == 'stepOver') {
        if (this.calcStackDepth(callStack.contractsStack) <= this.stepOverStackLevel) {
          bp = {
            line: mapping.line,
            source: mapping.path
          };
        }
      } else if (this.state == 'stepOut') {
        if (this.calcStackDepth(callStack.contractsStack) < this.stepOutStackLevel) {
          bp = {
            line: mapping.line,
            source: mapping.path
          };
        }
      } else {
        bp = _.find(this.breakpoints, {
          source: mapping.path,
          line: mapping.line
        });
      }
      this.prevBp = bp;
      if (bp) this.state = 'running';
    }
    return bp;
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
  calcStackDepth: function(contractsStack) {
    return _(contractsStack)
      .map(function(contract) {
        return contract.calls.length;
      })
      .sum();
  }
};

module.exports = Tracer;
