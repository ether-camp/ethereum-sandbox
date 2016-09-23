var _ = require('lodash');
var util = require('../../util');

var MappingType = {
  name: null,
  type: null,

  is: function(node) {
    return node.name == 'Mapping';
  },
  init: function(node, typeCreator, contract) {
    this.keyType = typeCreator.create(node.children[0], contract);
    this.valueType = typeCreator.create(node.children[1], contract);
    console.log(this.keyType, this.valueType);
    this.type = 'mapping (' + this.keyType.type + ' => ' + this.valueType.type + ')';
    return this;
  },
  retrieve: function(storage, hashDict, position) {
    var self = this;
    if (position.offset > 0) {
      util.inc(position.index);
      position.offset = 0;
    }

    var result = MappingType.isPrototypeOf(this.valueType) ?
          this.retrieveMapping(storage, hashDict, position) :
          this.retrieveNotMapping(storage, hashDict, position);

    util.inc(position.index);
    return result;
  },
  retrieveNotMapping: function(storage, hashDict, position) {
    var self = this;
    
    return _(storage)
      .map(function(entry) {
        var hashDetails = _.find(hashDict, function(details) {
          return details.hash.equals(entry.key);
        });
        var result;
        if (hashDetails) {
          result = {
            key: hashDetails.hash,
            keySrc: hashDetails.src,
            value: entry.value
          };
        }
        return result;
      })
      .compact()
      .filter(function(entry) {
        return entry.keySrc.length >= 32 &&
          entry.keySrc.slice(entry.keySrc.length - 32).equals(position.index);
      })
      .map(function(entry) {
        var position = {
          index: new Buffer(entry.key),
          offset: 0
        };
        return [
          self.keyType.parseValue(entry.keySrc.slice(0, entry.keySrc.length - 32)),
          self.valueType.retrieve(storage, hashDict, position)
        ];
      })
      .object()
      .value();
  },
  retrieveMapping: function(storage, hashDict, position) {
    var self = this;
    
    return _(hashDict)
      .filter(function(details) {
        return details.src.length >= 32 &&
          details.src.slice(details.src.length - 32).equals(position.index);
      })
      .map(function(details) {
        var internalPosition = {
          index: new Buffer(details.hash),
          offset: 0
        };
        var value = self.valueType.retrieve(storage, hashDict, internalPosition);
        return Object.keys(value).length > 0 ?
          [
            self.keyType.parseValue(details.src.slice(0, details.src.length - 32)),
            value
          ] :
          null;
      })
      .compact()
      .object()
      .value();
  }
};

module.exports = MappingType;
