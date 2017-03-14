var _ = require('lodash');

var Method = {
  init: function(type, node, typeCreator, contract, source) {
    this.type = type;
    this.typeCreator = typeCreator;
    this.contract = contract;
    this.source = source;
    this.sourceIndex = parseInt(node.src.split(':')[2]) - 1;

    this.area = {
      start: { line: 0, column: 0 },
      end: { line: 0, column: 0 }
    };
    var srcmap = node.src.split(':').map(_.partial(parseInt, _, 10));
    this.area.start = this._calcPosition(srcmap[0]);
    this.area.end = this._calcPosition(srcmap[0] + srcmap[1]);
    
    this.blockArea = {
      start: { line: 0, column: 0 },
      end: { line: 0, column: 0 }
    };
    var blockNode = _.find(node.children, { name: 'Block' });
    if (blockNode) {
      srcmap = blockNode.src.split(':').map(_.partial(parseInt, _, 10));
      this.blockArea.start = this._calcPosition(srcmap[0]);
      this.blockArea.end = this._calcPosition(srcmap[0] + srcmap[1]);
    }

    this.variables = {
      args: this._buildVars(node.children[0]),
      block: []
    };
    if (blockNode) this.variables.block = this._buildVars(blockNode);

    this.name = this.contract.name + '.' + node.attributes.name + '(' +
      _(this.variables.args).map('type').join(',') + ')';

    this.varsStackSize = _.sum(this.variables.args, 'stackSize') +
      _.sum(this.variables.block, 'stackSize');
    this.ownVarsStackSize = this.varsStackSize;

    return this;
  },
  inMethod: function(position) {
    return this._inArea(position, this.area);
  },
  inBlock: function(position) {
    return this._inArea(position, this.blockArea);
  },
  isVarDeclaration: function(position) {
    var self = this;
    return _.some(this.variables.block, this._inArea.bind(this, position));
  },
  allVariables: function() {
    return this.variables.args.concat(this.variables.block);
  },
  parseVariables: function(stackPointer, calldata, stack, memory, storage, hashDict) {
    var position = { index: stackPointer };
    return _.map(this.allVariables(), function(variable) {
      var value;
      if (variable.storageType == 'memory' || variable.storageType == 'stack') {
        value = variable.retrieveStack(stack, memory, position.index);
        position.index++;
      } else if (variable.storageType == 'calldata') {
        value = variable.retrieveData(stack, calldata, position);
      } else {
        var idx = stack[position.index];
        var zeroBuf = true;
        for (var i = 0; i < idx.length && zeroBuf; i++) {
          zeroBuf = (idx[i] == 0);
        }
        if (zeroBuf) {
          value = 'not initialized';
        } else {
          var idxCopy = new Buffer(32).fill(0);
          idx.copy(idxCopy, 32 - idx.length);
          value = variable.retrieve(storage, hashDict, { index: idxCopy, offset: 0 });
        }
        position.index++;
      }
      return {
        name: variable.name,
        type: variable.type,
        value: value
      };
    });
  },
  _buildVars: function(node) {
    var self = this;
    return _(node.children)
      .map(function(node) {
        return node.name == 'VariableDeclaration' ?
          self._buildVar(node) : self._buildVars(node);
      })
      .flatten()
      .compact()
      .value();
  },
  _buildVar: function(node) {
    var typeHandler = this.typeCreator.create(node.attributes.type,
                                              this.contract.name);
    if (typeHandler) {
      typeHandler.name = node.attributes.name;
      var srcmap = node.src.split(':').map(_.partial(parseInt, _, 10));
      typeHandler.start = this._calcPosition(srcmap[0]);
      typeHandler.end = this._calcPosition(srcmap[0] + srcmap[1]);
    }
    return typeHandler;
  },
  _calcPosition: function(offset) {
    var line = numberOf(this.source, '\n', offset);
    var column = offset;
    if (line > 0) {
      column = offset - this.source.substr(0, offset).lastIndexOf('\n') - 1;
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
  },
  _inArea: function(position, area) {
    return position.source == this.sourceIndex &&
      (position.line > area.start.line ||
       (position.line == area.start.line &&
        position.column >= area.start.column)) &&
      (position.line < area.end.line ||
       (position.line == area.end.line &&
        position.column < area.end.column));
  }
};

module.exports = Method;
