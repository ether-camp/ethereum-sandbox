var _ = require('lodash');
var Method = require('./method');

var Func = Object.create(Method);

Func.init = function(node, typeCreator, contract, source) {
  Method.init.call(this, 'function', node, typeCreator, contract, source);

  this.public = node.attributes.public;
  this.isConstructor = contract.name == node.attributes.name;
  this.isFallback = (node.attributes.name == '');

  this.variables.returns = this._buildVars(node.children[1]);
  this.varsStackSize += _.sum(this.variables.returns, 'stackSize');
  this.ownVarsStackSize = this.varsStackSize;

  this.modifiers = _(node.children)
    .filter({ name: 'ModifierInvocation' })
    .map(function(node) {
      return node.children[0].attributes.value;
    })
    .value();

  return this;
};

Func.allVariables = function() {
  return this.variables.args.concat(
    this.variables.returns.concat(this.variables.block)
  );
};

Func.readModifiers = function() {
  this.modifiers = _.map(this.modifiers,
                         this.contract.findModifier.bind(this.contract));
  this.varsStackSize += _.sum(this.modifiers, 'varsStackSize');
};

Func.findModifierIndex = function(position) {
  return _.findIndex(this.modifiers, function(modifier) {
    return modifier.inBlock(position) &&
      !modifier.isVarDeclaration(position);
  });
};

Func.getVarsOffsetForModifier = function(modifierIndex) {
  return this.ownVarsStackSize +
    _.sum(this.modifiers.slice(0, modifierIndex + 1), 'varsStackSize');
};

module.exports = Func;
