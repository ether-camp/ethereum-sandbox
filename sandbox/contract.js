var fs = require('fs');
var _ = require('lodash');
var async = require('async');
var parseContracts = require('../ast/parser');

var Contract = {
  init: function(tx, cb) {
    var self = this;
    _.assign(this, tx.contract);
    this.data = tx.data;
    this.breakpoints = [];
    this.deployed = false;
    parseContracts(this.ast, this.root, function(err, contracts) {
      if (err) return cb(err);
      self.details = _.find(contracts, { name: self.name });
      parseSourceMap(self.srcmap, self.data, self.sourceList, function(err, srcmap) {
        if (err) return cb(err);
        self.srcmap = srcmap;
        cb(null, self);
      });
    });
  },
  deploy: function(gasUsed, code, cb) {
    var self = this;
    this.deployed = true;
    this.gasUsed = gasUsed;
    parseSourceMap(this.srcmapRuntime, code, this.sourceList, function(err, srcmap) {
      if (err) return cb(err);
      self.srcmapRuntime = srcmap;
      cb(null, self);
    });
  },
  getDetails: function() {
    return {
      name: this.name,
      binary: this.binary,
      abi: this.abi,
      gasUsed: this.gasUsed,
      data: this.data
    };
  }
};

function parseSourceMap(srcmap, code, paths, cb) {
  async.map(paths, function(path, cb) {
    fs.readFile(path, 'utf8', cb);
  }, function(err, sources) {
    if (err) return cb(err);
    
    var prev = {
      line: 0,
      source: 0
    };
    var pc = 0;
    var result = _.map(srcmap.split(';'), function(details) {
      var entries = details.split(':');

      line = prev.line;
      if (entries[0]) {
        var line = calcLine(
          parseInt(entries[0]),
          sources[entries[2] ? parseInt(entries[2]) - 1 : prev.source]
        );
      }
    
      var mapping = {
        line: line,
        source: entries[2] ? parseInt(entries[2]) - 1 : prev.source,
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
function calcLine(offset, source) {
  return numberOf(source, '\n', offset);

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
