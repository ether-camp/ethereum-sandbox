var _ = require('lodash');

var Func = {
  init: function(options) {
    var self = this;
    this.name = parseSignature(options.node, options.typeCreator, options.contractName);
    this.lineStart = options.lineStart;
    this.lineEnd = options.lineEnd;
    this.source = options.source;
    var buildVar = buildVariable.bind(null, options.typeCreator, options.contractName);
    this.variables = _.map(options.node.children[0].children, buildVar);
    this.variables = this.variables.concat(
      _.map(options.node.children[1].children, buildVar)
    );
    if (options.node.children.length == 3) {
      this.variables = this.variables.concat(
        parseVariables(options.typeCreator, options.contractName, options.node.children[2])
      );
    }
    return this;
  },
  parseVariables: function(stack, memory) {
    return _.map(this.variables, function(variable, index) {
      return {
        name: variable.name,
        type: variable.type,
        value: variable.storageType == 'memory' ?
          variable.retrieveStack(stack, memory, index) :
          '[not implemented]'
      };
    });
  }
};

function parseSignature(node, typeCreator, contractName) {
  var paramNodes = _.find(node.children, { name: 'ParameterList' }).children;
  var params = _.map(paramNodes, function(node) {
    return typeCreator.create(node.children[0], contractName).type;
  });
  return node.attributes.name + '(' + params.join(',')  + ')';
}

function buildVariable(typeCreator, contractName, node) {
  var typeHandler = typeCreator.create(node.children[0], contractName);
  if (typeHandler) {
    typeHandler.name = node.attributes.name;
    typeHandler.storageType = node.attributes.type.indexOf('storage') > 0 ?
      'storage' : 'memory';
  }
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

module.exports = Func;
