var _ = require('lodash');
var async = require('async');
var util = require('../util');
var Creator = require('./type_creator');
var ContractType = require('./types/contract');
var StructType = require('./types/struct');

function parse(sources) {
  var userDefinedTypes = _(sources)
        .map(function(ast, file) {
          return parseTypes(ast.AST);
        })
        .flatten()
        .value();
  var typeCreator = Object.create(Creator).init(userDefinedTypes);
  return _(sources)
    .map(function(ast, file) {
      var contracts = parseVariables(ast.AST, typeCreator);
      _.each(contracts, function(contract) {
        contract.file = file;
      });
      return contracts;
    })
    .flatten()
    .value();
}

function parseTypes(node) {
  return _(node.children)
    .filter({ name: 'ContractDefinition' })
    .map(function(node) {
      var name = node.attributes.name;
      var types = [ Object.create(ContractType).create(name) ];
      types = types.concat(
        _(node.children)
          .filter({ name: 'StructDefinition' })
          .map(function(node) {
            return Object.create(StructType).create(node, name);
          })
          .value()
      );
      return types;
    })
    .flatten()
    .value();
}

function parseVariables(node, typeCreator) {
  return _(node.children)
    .filter({ name: 'ContractDefinition' })
    .map(function(node) {
      return new Contract(node, typeCreator);
    })
    .value();
}

function Contract(node, typeCreator) {
  var self = this;
  this.name = node.attributes.name;
  this.vars =_(node.children)
    .filter({ name: 'VariableDeclaration' })
    .map(function(node) {
      var typeHandler = typeCreator.create(node.children[0], self.name);
      if (typeHandler) typeHandler.name = node.attributes.name;
      return typeHandler;
    })
    .compact()
    .value();
}

Contract.prototype.getStorageVars = function(storage, hashDict) {
  var position = { index: new Buffer(32).fill(0), offset: 0 };
  return _.map(this.vars, function(variable) {
    var value = variable.retrieve(storage, hashDict, position);
    return {
      name: variable.name,
      type: variable.type,
      value: value
    };
  });
};

module.exports = parse;
