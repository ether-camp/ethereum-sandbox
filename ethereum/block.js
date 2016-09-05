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
 
var util = require('../util');
var _ = require('lodash');

module.exports = {
  init: function(block) {
    this.block = block;
    return this;
  },
  getDetails: function(fullTx) {
    return {
      number: util.toHex(this.block.header.number),
      hash: util.toHex(this.block.hash()),
      parentHash: util.toHex(this.block.header.parentHash),
      nonce: '0x0000000000000000',
      sha3Uncles: util.toHex(this.block.header.uncleHash),
      logsBloom: util.toHex(this.block.header.bloom),
      transactionsRoot: util.toHex(this.block.header.transactionsTrie),
      stateRoot: util.toHex(this.block.header.stateRoot),
      miner: util.toHex(this.block.header.coinbase),
      difficulty: util.toHex(this.block.header.difficulty),
      // TODO: calculate total difficulty for the block
      totalDifficulty: util.toHex(this.block.header.difficulty), 
      extraData: util.toHex(this.block.header.extraData),
      size: util.toHex(this.block.serialize(true).length),
      gasLimit: util.toHex(this.block.header.gasLimit),
      // TODO: Fix the bug because of which block.header.gasPrice is empty
      gasUsed: util.toHex(this.block.header.gasUsed),
      timestamp: util.toHex(this.block.header.timestamp),
      // TODO: Add support of fullTransactions=true
      transactions: _(this.block.transactions).invoke('hash').map(util.toHex),
      uncles: []
    };
  }
};
