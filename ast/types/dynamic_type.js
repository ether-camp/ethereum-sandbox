var _ = require('lodash');
var async = require('async');
var util = require('../../util');

var DynamicType = {
  is: function(typeName) {
    return this.matchType(typeName);
  },
  init: function(typeName) {
    this.type = typeName;
    this.storageType = typeName.substr(typeName.indexOf(' ') + 1);
    this.stackSize = this.storageType == 'calldata' ? 2 : 1;
    return this;
  },
  retrieve: function(storage, hashDict, position) {
    if (position.offset > 0) {
      util.inc(position.index);
      position.offset = 0;
    }

    var entry = _.find(storage, function(entry) {
      return entry.key.equals(position.index);
    });

    var value = '';
    if (entry) {
      var data = util.decodeRlp(entry.value);
      var short = (data[data.length - 1] % 2 == 0);
      if (short) {
        var len = data[data.length - 1] / 2;
        value = this.parseValue(data.slice(0, len));
      } else {
        len = (data.readUIntBE(0, data.length) - 1) / 2;
        var hash = util.sha3(position.index, 'binary');
        while (len > 0) {
          entry = _.find(storage, function(entry) {
            return entry.key.equals(hash);
          });
          
          data = entry ?
            util.decodeRlp(entry.value) :
            new Buffer(len > 32 ? 32 : len).fill(0);

          value = this.appendValue(value, data.slice(0, len));
              
          len -= 32;
          util.inc(hash);
        }
      }
    }
    util.inc(position.index);
    return value;
  },
  retrieveStack: function(stack, memory, index) {
    var offset = stack[index].readUIntBE(0, stack[index].length);
    var length = Buffer.from(memory.slice(offset, offset + 32)).readUIntBE(0, 32);
    var data = Buffer.from(memory.slice(offset + 32, offset + 32 + length));
    return this.parseValue(data);
  },
  retrieveData: function(stack, calldata, position) {
    var offset = stack[position.index].readUIntBE(0, stack[position.index].length);
    position.index++;
    var length = stack[position.index].readUIntBE(0, stack[position.index].length);
    position.index++;
    var data = Buffer.from(calldata.slice(offset, offset + length));
    return this.parseValue(data);
  }
};

module.exports = DynamicType;
