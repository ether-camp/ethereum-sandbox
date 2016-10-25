var _ = require('lodash');

var Tracer = {
  breakpoints: [],
  prevBp: null,
  state: 'running', // running, stepInto, stepOver, stepOut
  init: function(sourceList) {
    return this;
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
        if (callStack.calls.length <= this.stepOverStackLevel) {
          bp = {
            line: mapping.line,
            source: mapping.path
          };
        }
      } else if (this.state == 'stepOut') {
        if (callStack.calls.length < this.stepOutStackLevel) {
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
      this.state = 'running';
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
  }
};

module.exports = Tracer;
