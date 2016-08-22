var util = require('../../util');

var ElementaryType = {
  name: null,
  type: null,
  size: null,
  
  is: function(node) {
    return node.children[0].node = 'ElementaryTypeName' &&
      this.matchType(node.children[0].attributes.name);
  },
  init: function(node) {
    this.name = node.attributes.name;
    this.type = node.children[0].attributes.name;
    this.size = this.getSize(this.type);
    return this;
  },
  retrieve: function(getter, position, cb) {
    var self = this;
    
    if (32 - position.offset < this.size) {
      position.index++;
      position.offset = 0;
    }
    
    getter(util.toBuffer(position.index, 64), function(err, data) {
      if (err) return cb(err);
      
      var value = '0';
      if (data) {
        data = util.decodeRlp(data);
        if (data.length >= position.offset) {
          var from = data.length - position.offset - self.size;
          value = data.toString('hex', from > 0 ? from : 0, data.length - position.offset);
        }
      }
      
      if (self.size + position.offset >= 32) {
        position.index++;
        position.offset = 0;
      } else {
        position.offset += self.size;
      }

      cb(null, {
        name: self.name,
        type: self.type,
        value: self.parseValue(value)
      });
    });
  }
};

module.exports = ElementaryType;
