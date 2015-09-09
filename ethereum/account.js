var Account = require('ethereumjs-account');
var util = require('../util');

module.exports = {
  init: function(data) {
    var raw = new Account(data);
    this.nonce = util.toBigNumber(raw.nonce);
    this.balance = util.toBigNumber(raw.balance);
    this.stateRoot = raw.stateRoot;
    return this;
  },
  readStorage: function(trie, cb) {
    this.storage = {};
    
    if (this.stateRoot.toString('hex') === util.SHA3_RLP_NULL) return cb();
    
    var strie = trie.copy();
    strie.root = this.stateRoot;
    var stream = strie.createReadStream();
    stream.on('data', (function(data) {
      this.storage[util.toHex(data.key)] = util.toHex(util.decodeRlp(data.value));
    }).bind(this));
    stream.on('end', cb);
  }
};
