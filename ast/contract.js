var _ = require('lodash');
var Func = require('./func');
var Modifier = require('./modifier');

var Contract = {
  init: function(node, source, file, typeCreator) {
    var self = this;
    
    this.name = node.attributes.name;
    this.file = file;
    this.isLibrary = node.attributes.isLibrary;
    this.vars =_(node.children)
      .filter({ name: 'VariableDeclaration' })
      .map(function(node) {
        var typeHandler = typeCreator.create(node.attributes.type, self.name);
        if (typeHandler) typeHandler.name = node.attributes.name;
        return typeHandler;
      })
      .compact()
      .value();
    this.methods = _(node.children)
      .filter({ name: 'FunctionDefinition' })
      .map(function(node) {
        return Object.create(Func).init(node, typeCreator, self, source);
      })
      .value();
    this.methods = this.methods.concat(
      _(node.children)
        .filter({ name: 'ModifierDefinition' })
        .map(function(node) {
          return Object.create(Modifier).init(node, typeCreator, self, source);
        })
        .value()
    );
    this.parents = _(node.children)
      .filter({ name: 'InheritanceSpecifier' })
      .map(function(node) {
        return node.children[0].attributes.name;
      })
      .value();
    
    return this;
  },
  getStorageVars: function(storage, hashDict, position) {
    if (!position) position = { index: new Buffer(32).fill(0), offset: 0 };
    var variables = _(this.parents)
        .map(function(contract) {
          return contract.getStorageVars(storage, hashDict, position);
        })
        .flatten()
      .value();
    return variables.concat(
      _.map(this.vars, function(variable) {
        var value = variable.retrieve(storage, hashDict, position);
        return {
          name: variable.name,
          type: variable.type,
          value: value
        };
      })
    );
  },
  findFunc: function(position) {
    var func = _.find(this.methods, function(method) {
      return method.type == 'function' && method.inMethod(position);
    });
    for (var i = 0; i < this.parents.length && !func; i++) {
      func = this.parents[i].findFunc(position);
    }
    return func;
  },
  findMethod: function(position) {
    var method = _.find(this.methods, function(method) {
      return method.inBlock(position) && !method.isVarDeclaration(position);
    });
    for (var i = 0; i < this.parents.length && !method; i++) {
      method = this.parents[i].findMethod(position);
    }
    return method;
  },
  findModifier: function(shortName) {
    var modifier = _.find(this.methods, function(method) {
      return method.type == 'modifier' &&
        _.contains(method.name, '.' + shortName + '(');
    });
    for (var i = 0; i < this.parents.length && !modifier; i++) {
      modifier = this.parents[i].findModifier(shortName);
    }
    return modifier;
  }
};

module.exports = Contract;
