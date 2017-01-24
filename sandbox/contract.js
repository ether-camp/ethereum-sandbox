var fs = require('fs');
var _ = require('lodash');
var async = require('async');
var parseContracts = require('../ast/parser');

var Contract = {
  init: function(tx, withDebug, cb) {
    var self = this;
    _.assign(this, tx.contract);
    this.data = tx.data;
    this.breakpoints = [];
    this.deployed = false;
    this.withDebug = withDebug;
    if (withDebug) {
      async.parallel({
        contracts: function(cb) {
          if (self.ast) parseContracts(self.ast, self.root, cb);
          else cb();
        },
        srcmap: function(cb) {
          if (self.srcmap)
            parseSourceMap(self.srcmap, self.data, self.root, self.sourceList, cb);
          else cb();
        }
      }, function(err, result) {
        if (err) return cb(err);
        self.details = result.contracts ?
          _.find(result.contracts, { name: self.name }) : null;
        self.srcmap = result.srcmap;
        cb(null, self);
      });
    } else cb(null, self);
  },
  deploy: function(gasUsed, code, cb) {
    var self = this;
    this.deployed = true;
    this.gasUsed = gasUsed;
    if (this.withDebug && this.srcmapRuntime) {
      parseSourceMap(this.srcmapRuntime, code, this.root, this.sourceList, function(err, srcmap) {
        if (err) return cb(err);
        self.srcmapRuntime = srcmap;
        cb(null, self);
      });
    } else cb(null, self);
  },
  getDetails: function() {
    return {
      name: this.name,
      binary: this.binary,
      abi: this.abi,
      gasUsed: this.gasUsed,
      data: this.data,
      root: this.root,
      sources: this.sourceList
    };
  }
};

function parseSourceMap(srcmap, code, root, paths, cb) {
  async.map(paths, function(path, cb) {
    fs.readFile(root + path, 'utf8', cb);
  }, function(err, sources) {
    if (err) return cb(err);
    
    var prev = {
      line: 0,
      column: 0,
      source: 0
    };
    var pc = 0;
    var result = _.map(srcmap.split(';'), function(details) {
      var entries = details.split(':');

      var position = {
        line: prev.line,
        column: prev.column
      };

      var sourceIndex = entries[2] ? parseInt(entries[2]) - 1 : prev.source;
      if (entries.indexOf('-1') >= 0 || sourceIndex < 0) {
        position = {
          line: -1,
          column: -1
        };
      } else if (entries[0]) {
        position = calcPosition(
          parseInt(entries[0]),
          sources[sourceIndex]
        );
      }

      var mapping = {
        line: position.line,
        column: position.column,
        source: sourceIndex,
        path: sourceIndex >= 0 ? root + paths[sourceIndex] : '',
        type: entries[3],
        pc: pc
      };

      // skip push argument
      if (code[pc] >= 0x60 && code[pc] <= 0x7f) {
        pc += code[pc] - 0x60 + 1;
      }
      
      pc++;
      
      prev = mapping;
      return mapping;
    });
    cb(null, result);
  });
}

function calcPosition(offset, source) {
  var line = numberOf(source, '\n', offset);
  var column = offset;
  if (line > 0) {
    column = offset - source.substr(0, offset).lastIndexOf('\n') - 1;
  }
  return {
    line: line,
    column: column
  };

  function numberOf(str, c, len) {
    var n = 0;
    var index = 0;
    str = str.substr(0, len);
    while (true) {
      index = str.indexOf('\n', index) + 1;
      if (index <= 0) break;
      n++;
    }
    return n;
  }
}

module.exports = Contract;
