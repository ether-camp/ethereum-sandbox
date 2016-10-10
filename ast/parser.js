var fs = require('fs');
var _ = require('lodash');
var async = require('async');
var util = require('../util');
var Creator = require('./type_creator');
var ContractType = require('./types/contract');
var StructType = require('./types/struct');
var EnumType = require('./types/enum');

function parse(details, dir, cb) {
  async.forEachOf(details, function(source, file, cb) {
    fs.readFile('/root/workspace' + dir + file, 'utf8', function(err, text) {
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
          _.each(contracts, function(contract) {
            contract.file = file;
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
  this.vars =_(node.children)
    .filter({ name: 'VariableDeclaration' })
    .map(function(node) {
      var typeHandler = typeCreator.create(node.children[0], self.name);
      if (typeHandler) typeHandler.name = node.attributes.name;
      return typeHandler;
    })
    .compact()
    .value();
  this.funcs = _(node.children)
    .filter({ name: 'FunctionDefinition' })
    .map(function(node) {
      var details = node.src.split(':');
      
      return {
        name: parseSignature(node, typeCreator),
        lineStart: calcLine(parseInt(details[0]), source),
        lineEnd: calcLine(parseInt(details[0]) + parseInt(details[1]), source),
        source: details[2] - 1
      };
    })
    .sortByOrder(['source', 'line'], ['asc', 'desc'])
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
    }));
};

Contract.prototype.getFuncName = function(position) {
  var func = _.find(this.funcs, function(func) {
    return func.source == position.source &&
      position.line > func.lineStart && position.line < func.lineEnd;
  });
  return func ? this.name + '.' + func.name : null;
};

function calcLine(offset, source) {
  return numberOf(source, '\n', offset);

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

function parseSignature(node, typeCreator, contractName) {
  var paramNodes = _.find(node.children, { name: 'ParameterList' }).children;
  var params = _.map(paramNodes, function(node) {
    return typeCreator.create(node.children[0], contractName).type;
  });
  return node.attributes.name + '(' + params.join(',')  + ')';
}

module.exports = parse;
