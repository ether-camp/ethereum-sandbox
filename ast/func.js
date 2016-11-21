var _ = require('lodash');

var Func = {
  init: function(node, typeCreator, contract, source) {
    this.contract = contract;
    this.public = node.attributes.public;
    
    var funcSrcmap = node.src.split(':').map(_.partial(parseInt, _, 10));
    this.funcStart = calcPosition(funcSrcmap[0], source);
    this.funcEnd = calcPosition(funcSrcmap[0] + funcSrcmap[1], source);

    var blockNode = _.find(node.children, { name: 'Block' });
    if (blockNode) {
      var blockSrcmap = blockNode.src.split(':').map(_.partial(parseInt, _, 10));
      this.blockStart = calcPosition(blockSrcmap[0], source);
      this.blockEnd = calcPosition(blockSrcmap[0] + blockSrcmap[1], source);
    }
    
    this.source = funcSrcmap[2] - 1;
    
    var buildVar = buildVariable.bind(null, typeCreator, contract.name, source);
    this.variables = _.map(node.children[0].children, buildVar);
    
    this.name = contract.name + '.' + node.attributes.name + '(' +
      _(this.variables).map('type').join(',') + ')';
      
    this.variables = this.variables.concat(
      _.map(node.children[1].children, buildVar)
    );
    if (blockNode) {
      this.variables = this.variables.concat(
        parseVariables(typeCreator, contract.name, source, blockNode)
      );
    }

    return this;
  },
  inFunc: function(position) {
    return position.source == this.source &&
      (position.line > this.funcStart.line ||
       (position.line == this.funcStart.line &&
        position.column >= this.funcStart.column)) &&
      (position.line < this.funcEnd.line ||
       (position.line == this.funcEnd.line &&
        position.column <= this.funcEnd.column));
  },
  inBlock: function(position) {
    return this.blockStart &&
      position.source == this.source &&
      (position.line > this.blockStart.line ||
       (position.line == this.blockStart.line &&
        position.column >= this.blockStart.column)) &&
      (position.line < this.blockEnd.line ||
       (position.line == this.blockEnd.line &&
        position.column <= this.blockEnd.column));
  },
  isVarDeclaration: function(position) {
    var self = this;
    return _.some(this.variables, function(variable) {
      return position.source == self.source &&
        (position.line > variable.start.line ||
         (position.line == variable.start.line &&
          position.column >= variable.start.column)) &&
        (position.line < variable.end.line ||
         (position.line == variable.end.line &&
          position.column <= variable.end.column));
    });
  },
  parseVariables: function(stackPointer, stack, memory, storage, hashDict) {
    return _.map(this.variables, function(variable, index) {
      var value;
      if (variable.storageType == 'memory') {
        value = variable.retrieveStack(stack, memory, stackPointer + index);
      } else {
        var idx = stack[stackPointer + index];
        var idxCopy = new Buffer(32).fill(0);
        idx.copy(idxCopy, 32 - idx.length);
        value = variable.retrieve(storage, hashDict, { index: idxCopy, offset: 0 });
      }
      return {
        name: variable.name,
        type: variable.type,
        value: value
      };
    });
  }
};

function buildVariable(typeCreator, contractName, source, node) {
  var typeHandler = typeCreator.create(node.attributes.type, contractName);
  if (typeHandler) {
    typeHandler.name = node.attributes.name;
    var srcmap = node.src.split(':').map(_.partial(parseInt, _, 10));
    typeHandler.start = calcPosition(srcmap[0], source);
    typeHandler.end = calcPosition(srcmap[0] + srcmap[1], source);
  }
  return typeHandler;
}

function parseVariables(typeCreator, contractName, source, node) {
  return _(node.children)
    .map(function(node) {
      return node.name == 'VariableDeclaration' ?
        buildVariable(typeCreator, contractName, source, node) :
        parseVariables(typeCreator, contractName, source, node);
    })
    .flatten()
    .compact()
    .value();
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

module.exports = Func;
