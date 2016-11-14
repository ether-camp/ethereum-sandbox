var _ = require('lodash');

var Func = {
  init: function(node, typeCreator, contract, source) {
    var self = this;
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
    
    var buildVar = buildVariable.bind(null, typeCreator, contract.name);
    this.variables = _.map(node.children[0].children, buildVar);
    
    this.name = contract.name + '.' + node.attributes.name + '(' +
      _(this.variables).map('type').join(',') + ')';
      
    this.variables = this.variables.concat(
      _.map(node.children[1].children, buildVar)
    );
    if (blockNode) {
      this.variables = this.variables.concat(
        parseVariables(typeCreator, contract.name, blockNode)
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
  parseVariables: function(stackPointer, stack, memory, storage, hashDict) {
    return _.map(this.variables, function(variable, index) {
      return {
        name: variable.name,
        type: variable.type,
        value: variable.storageType == 'memory' ?
          variable.retrieveStack(stack, memory, stackPointer + index) :
          variable.retrieve(
            storage,
            hashDict,
            { index: new Buffer(32).fill(0), offset: 0 }
          )
      };
    });
  }
};

function buildVariable(typeCreator, contractName, node) {
  var typeHandler = typeCreator.create(node.attributes.type, contractName);
  if (typeHandler) typeHandler.name = node.attributes.name;
  return typeHandler;
}

function parseVariables(typeCreator, contractName, node) {
  return _(node.children)
    .map(function(node) {
      return node.name == 'VariableDeclaration' ?
        buildVariable(typeCreator, contractName, node) :
        parseVariables(typeCreator, contractName, node);
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
