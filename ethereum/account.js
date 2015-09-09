var Account = require('ethereumjs-account');
var util = require('../util');

module.exports = {
  init: function(data) {
    var raw = new Account(data);
    this.nonce = util.toBigNumber(raw.nonce);
    this.balance = util.toBigNumber(raw.balance);
    return this;
  }
};
