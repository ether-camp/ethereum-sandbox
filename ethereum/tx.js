/*
 * Ethereum Sandbox
 * Copyright (C) 2016  <ether.camp> ALL RIGHTS RESERVED  (http://ether.camp)
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License version 3 for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
 
var Transaction = require('ethereumjs-tx');
var _ = require('lodash');
var util = require('../util');

module.exports = {
  init: function(optionsOrRlp) {
    if (optionsOrRlp) {
      if (_.isString(optionsOrRlp)) {
        this.tx = new Transaction(util.toBuffer(optionsOrRlp));
        this.from = util.toHex(this.tx.getSenderAddress());
        this.to = this.tx.to.length > 0 ? util.toHex(this.tx.to) : null;
        this.nonce = util.toBigNumber(this.tx.nonce);
        this.gasLimit = util.toBigNumber(this.tx.gasLimit);
        this.gasPrice = util.toBigNumber(this.tx.gasPrice);
        this.value = util.toBigNumber(this.tx.value);
        this.data = this.tx.data.length > 0 ? util.toHex(this.tx.data) : null;
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
  },
  hash: function() {
    return util.toHex(this.getTx().hash());
  }
};
