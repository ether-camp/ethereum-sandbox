var fs = require('fs');
var _ = require('lodash');
var async = require('async');
var Creator = require('./type_creator');
var Contract = require('./contract');
var ContractType = require('./types/contract');
var StructType = require('./types/struct');
var EnumType = require('./types/enum');

function parse(details, root, cb) {
  async.forEachOf(details, function(source, file, cb) {
    fs.readFile(root + file, 'utf8', function(err, text) {
      if (err) return cb(err.message);
      source.text = text;
      cb();
    });
  }, function(err) {
    if (err) return cb(err);

    var userDefinedTypes = _(details)
        .map(function(entry) {
          return parseTypes(entry.AST);
        })
        .flatten()
        .value();
    
    var typeCreator = Object.create(Creator).init(userDefinedTypes);
    
    var contracts = _(details)
        .map(function(entry, file) {
          return parseContracts(entry.AST, entry.text, file, typeCreator);
        })
        .flatten()
        .value();

    _.each(contracts, function(contract) {
      contract.parents = _.map(contract.parents, function(name) {
        return _.find(contracts, { name: name });
      });
    });

    _.each(contracts, function(contract) {
      _(contract.methods)
        .filter({ type: 'function' })
        .invoke('readModifiers')
        .value();
    });

    // call of library internal function looks just like a call of an own function
    var internalLibFuncs = _(contracts)
        .map(function(contract) {
          if (contract.isLibrary) {
            return _.filter(contract.methods,
                            { type: 'function', public: false });
          } else {
            return [];
          }
        })
        .flatten()
        .value();
    
    _.each(contracts, function(contract) {
      contract.methods = contract.methods.concat(internalLibFuncs);
    });
    
    cb(null, contracts);
  });
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
      types = types.concat(
        _(node.children)
          .filter({ name: 'EnumDefinition' })
          .map(function(node) {
            return Object.create(EnumType).create(node, name);
          })
          .value()
      );
      return types;
    })
    .flatten()
    .value();
}

function parseContracts(node, source, file, typeCreator) {
  return _(node.children)
    .filter({ name: 'ContractDefinition' })
    .map(function(node) {
      return Object.create(Contract).init(node, source, file, typeCreator);
    })
    .value();
}

module.exports = parse;
