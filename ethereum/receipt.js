var BigNumber = require('bignumber.js');
var util = require('../util');

module.exports = {
  init: function(tx, block, receipt, result) {
    var hash = util.toHex(tx.getTx().hash() );
    this.from = tx.from;
    this.to = tx.to;
    this.nonce = tx.nonce;
    this.value = tx.value;
    this.data = tx.data;
    this.gasLimit = tx.gasLimit;
    this.gasPrice = tx.gasPrice;
    this.txHash = util.toHex(tx.getTx().hash());
    this.txIndex = new BigNumber(1);
    this.blockNumber = util.toBigNumber(block.header.number);
    this.blockHash = util.toHex(block.hash());
    this.cumulativeGasUsed = util.toBigNumber(receipt.gasUsed);
    this.gasUsed = util.toBigNumber(receipt.gasUsed);
    this.contractAddress = result.createdAddress ? util.toHex(result.createdAddress) : null;
    this.logs = [];
    return this;
  },
  getReceiptDetails: function() {
    return {
      transactionHash: this.txHash,
      transactionIndex: util.toHex(this.txIndex),
      blockNumber: util.toHex(this.blockNumber),
      blockHash: this.blockHash,
      cumulativeGasUsed: util.toHex(this.cumulativeGasUsed),
      gasUsed: util.toHex(this.gasUsed),
      contractAddress: this.contractAddress,
      logs: this.logs
    };
  },
  getTxDetails: function() {
    return {
      hash: this.txHash,
      nonce: util.toHex(this.nonce),
      blockHash: this.blockHash,
      blockNumber: util.toHex(this.blockNumber),
      transactionIndex: util.toHex(this.txIndex),
      from: this.from,
      to: this.to,
      value: util.toHex(this.value),
      gas: util.toHex(this.gasLimit),
      gasPrice: util.toHex(this.gasPrice),
      input: this.data
    };
  }
};
