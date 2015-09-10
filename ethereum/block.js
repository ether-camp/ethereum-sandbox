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
      minGasPrice: util.toHex(_(this.block.transactions).map('gasPrice').map(util.toNumber).min()),
      // TODO: Fix the bug because of which block.header.gasPrice is empty
      gasUsed: util.toHex(this.block.header.gasUsed),
      timestamp: util.toHex(this.block.header.timestamp),
      // TODO: Add support of fullTransactions=true
      transactions: _(this.block.transactions).invoke('hash').map(util.toHex),
      uncles: []
    };
  }
};
