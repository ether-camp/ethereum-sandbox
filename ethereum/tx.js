var Transaction = require('ethereumjs-tx');
var _ = require('lodash');
var util = require('../util');

module.exports = {
  init: function(optionsOrRlp) {
    if (optionsOrRlp) {
      if (_.isString(optionsOrRlp)) {
        this.tx = new Transaction(util.toBuffer(optionsOrRlp));
        this.from = util.toHex(this.tx.getSenderAddress());
        this.nonce = util.toBigNumber(this.tx.nonce);
        this.gasLimit = util.toBigNumber(this.tx.gasLimit);
        this.gasPrice = util.toBigNumber(this.tx.gasPrice);
        this.value = util.toBigNumber(this.tx.value);
      } else
        _.assign(this, optionsOrRlp);
    }
    return this;
  },
  getTx: function() {
    if (this.tx) return this.tx;
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
