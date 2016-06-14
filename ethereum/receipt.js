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
 
var BigNumber = require('bignumber.js');
var util = require('../util');
var _ = require('lodash');

module.exports = {
  init: function(tx, block, receipt, result) {
    var realTx = tx.getTx();
    var hash = util.toHex(realTx.hash());
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
    this.rlp = util.toHex(realTx.serialize());
    this.returnValue = result.vm.return ? util.toHex(result.vm.return) : null;
    this.exception = result.vm.exceptionError || null;

    this.logs = _.map(result.vm.logs, function(log, index) {
      return {
        logIndex: '0x' + index,
        transactionIndex: '0x1',
        transactionHash: this.txHash,
        blockHash: this.blockHash,
        blockNumber: util.toHex(this.blockNumber),
        address: util.toHex(log[0]),
        data: log[2].length == 0 ? '' : util.toHex(log[2]),
        topics: _.map(log[1], _.partial(util.toHex, _, undefined))
      };
    }, this);
    
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
  },
  getDetails: function() {
    return {
      from: this.from,
      nonce: util.toHex(this.nonce),
      to: this.to,
      gasLimit: util.toHex(this.gasLimit),
      gasUsed: util.toHex(this.gasUsed),
      value: util.toHex(this.value),
      data: this.data,
      createdAddress: this.contractAddress,
      returnValue: this.returnValue,
      exception: this.exception,
      rlp: this.rlp
    };
  }
};
