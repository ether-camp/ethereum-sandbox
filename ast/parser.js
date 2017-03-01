var fs = require('fs');
var _ = require('lodash');
var async = require('async');
var util = require('../util');
var Creator = require('./type_creator');
var ContractType = require('./types/contract');
var StructType = require('./types/struct');
var EnumType = require('./types/enum');
var Func = require('./func');
var Modifier = require('./modifier');

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
          var contracts = parseContracts(entry.AST, entry.text, typeCreator);
          var internalLibFuncs = _(contracts)
              .map(function(contract) {
                if (contract.isLibrary) {
                  return _.filter(contract.funcs, { public: false });
                } else {
                  return [];
                }
              })
              .flatten()
              .value();
          _.each(contracts, function(contract) {
            contract.file = file;
            contract.funcs = contract.funcs.concat(internalLibFuncs);
          });
          return contracts;
        })
        .flatten()
        .value();
    _.each(contracts, function(contract) {
      contract.parents = _.map(contract.parents, function(name) {
        return _.find(contracts, { name: name });
      });
    });
    _.each(contracts, function(contract) {
      _.each(contract.funcs, function(func) {
        var stackOffset = func.variables.length;
        func.modifiers = _(func.modifiers)
          .map(function(shortName) {
            // it might be a call of a parent constructor
            var modifier = contract.getModifier(shortName);
            if (modifier) {
              var details = {
                modifier: modifier,
                stackOffset: stackOffset
              };
              stackOffset += details.modifier.variables.length;
              return details;
            } else {
              return null;
            }
          })
          .compact()
          .value();
      });
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

function parseContracts(node, source, typeCreator) {
  return _(node.children)
    .filter({ name: 'ContractDefinition' })
    .map(function(node) {
      return new Contract(node, source, typeCreator);
    })
    .value();
}

function Contract(node, source, typeCreator) {
  var self = this;
  this.name = node.attributes.name;
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
  this.funcs = _(node.children)
    .filter({ name: 'FunctionDefinition' })
    .map(function(node) {
      return Object.create(Func).init(node, typeCreator, self, source);
    })
    .value();
  this.modifiers = _(node.children)
    .filter({ name: 'ModifierDefinition' })
    .map(function(node) {
      return Object.create(Modifier).init(node, typeCreator, self, source);
    })
    .value();
  this.parents = _(node.children)
    .filter({ name: 'InheritanceSpecifier' })
    .map(function(node) {
      return node.children[0].attributes.name;
    })
    .value();
}

Contract.prototype.getStorageVars = function(storage, hashDict, position) {
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
};

Contract.prototype.getFunc = function(position) {
  var func = _.find(this.funcs, function(func) {
    return func.inFunc(position);
  });
  for (var i = 0; i < this.parents.length && !func; i++) {
    func = this.parents[i].getFunc(position);
  }
  return func;
};

Contract.prototype.getModifier = function(shortName) {
  var modifier = _.find(this.modifiers, function(modifier) {
    return _.contains(modifier.name, '.' + shortName + '(');
  });
  for (var i = 0; i < this.parents.length && !modifier; i++) {
    modifier = this.parents[i].getModifier(shortName);
  }
  return modifier;
};

module.exports = parse;
