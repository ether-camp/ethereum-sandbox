var Account = require('ethereumjs-account');
var util = require('../util');

module.exports = {
  init: function(data) {
    this.raw = new Account(data);
    this.nonce = util.toBigNumber(this.raw.nonce);
    this.balance = util.toBigNumber(this.raw.balance);
    return this;
  },
  readStorage: function(trie, cb) {
    this.storage = {};
    
    if (this.raw.stateRoot.toString('hex') === util.SHA3_RLP_NULL) return cb();
    
    var strie = trie.copy();
    strie.root = this.raw.stateRoot;
    var stream = strie.createReadStream();
    stream.on('data', (function(data) {
      this.storage[util.toHex(data.key)] = util.toHex(util.decodeRlp(data.value));
    }).bind(this));
    stream.on('end', cb.bind(null, null, this.storage));
  },
  readCode: function(trie, cb) {
    this.code = null;
    this.raw.getCode(trie, (function(err, code) {
      this.code = util.toHex(code);
      cb(null, this.code);
    }).bind(this));
  }
};
