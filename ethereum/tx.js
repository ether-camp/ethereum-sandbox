var Transaction = require('ethereumjs-tx');
var _ = require('lodash');
var util = require('../util');

module.exports = {
  init: function(options) {
    if (options) _.assign(this, options);
    return this;
  },
  getTx: function() {
    var tx = new Transaction({
      nonce: !this.nonce || this.nonce.isZero() ? null : this.nonce.toNumber(),
      gasPrice: this.gasPrice.toNumber(),
      gasLimit: this.gasLimit.toNumber(),
      to: this.to ? util.toBuffer(this.to) : null,
      value: !this.value || this.value.isZero() ? null : this.value.toNumber(),
      data: this.data ? util.toBuffer(this.data) : null
    });
    tx.sign(util.toBuffer(this.pkey));
    return tx;
  }
};
