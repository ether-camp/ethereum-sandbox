var _ = require('lodash');
var async = require('async');
var util = require('../util');
var creator = require('./type_creator');

function parse(sources) {
  return _(sources)
    .map(function(ast, file) {
      var contracts = parseRoot(ast.AST);
      _.each(contracts, function(contract) {
        contract.file = file;
      });
      return contracts;
    })
    .flatten()
    .value();
}

function parseRoot(node) {
  return _(node.children)
    .filter({ name: 'ContractDefinition' })
    .map(function(node) {
      return new Contract(node);
    })
    .value();
}

function Contract(node) {
  this.name = node.attributes.name;
  this.vars =_(node.children)
    .filter({ name: 'VariableDeclaration' })
    .map(function(node) {
      var typeHandler = creator.create(node.children[0]);
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
