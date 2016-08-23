var _ = require('lodash');
var async = require('async');
var util = require('../util');
var createVariable = require('./types');

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
      return createVariable(node);
    })
    .compact()
    .value();
}

Contract.prototype.getStorageVars = function(account, trie, cb) {
  var position = { index: 0, offset: 0 };
  async.mapSeries(
    this.vars,
    function(variable, cb) {
      variable.retrieve(account.getStorage.bind(account, trie), position, cb);
    },
    cb
  );
};

module.exports = parse;
