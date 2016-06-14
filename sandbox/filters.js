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
 
var _ = require('lodash');
var util = require('../util');
var BigNumber = require('bignumber.js');

var Filters = {
  init: function(sandbox) {
    this.sandbox = sandbox;
    this.currentBlockNum = new BigNumber(0);
    this.lastFilterNum = 0;
    this.filters = {};

    return this;
  },
  destroy: function() {
    this.sandbox = null;
    this.filters = {};
    this.currentBlockNum = null;
  },
  nextNum: function() { return '0x' + (this.lastFilterNum++).toString(16); },
  addFilter: function(details) {
    if (details.fromBlock == 'earliest') details.fromBlock = new BigNumber(0);
    else if (details.fromBlock == 'pending') details.fromBlock = this.currentBlockNum;
    else if (details.fromBlock == 'latest') details.fromBlock = this.currentBlockNum;
    
    if (details.toBlock == 'earliest') details.toBlock = 0;
    else if (details.toBlock == 'pending') details.toBlock = 'latest';

    var num = this.nextNum();
    this.filters[num] = {
      type: 'log',
      fromBlock: details.fromBlock,
      toBlock: details.toBlock,
      address: details.address,
      topics: details.topics,
      entries: [],
      sent: []
    };
    if (details.fromBlock.lessThan(this.currentBlockNum)) {
      var entries = _(this.sandbox.receipts)
            .filter((function(receipt) {
              return details.fromBlock.lessThanOrEqualTo(this.currentBlockNum) &&
                (details.toBlock == 'latest' ||
                 details.toBlock.greaterThanOrEqualTo(this.currentBlockNum));
            }).bind(this))
            .map('logs')
            .flatten();

      this.filters[num].entries = entries.value();
    }
    return num;
  },
  addPendingTxFilter: function() {
    var num = this.nextNum();
    this.filters[num] = {
      type: 'pending',
      entries: [],
      sent: []
    };
    return num;
  },
  addBlockFilter: function() {
    var num = this.nextNum();
    this.filters[num] = {
      type: 'block',
      entries: [],
      sent: []
    };
    return num;
  },
  newBlock: function(block) {
    this.currentBlockNum = util.toBigNumber(block.header.number);
    var hash = util.toHex(block.hash());
    _(this.filters)
      .filter({type: 'block'})
      .each(function(filter) {
        filter.entries.push(hash);
      })
      .value();
  },
  newLogs: function(logs) {
    _(this.filters)
      .filter({ type: 'log' })
      .filter((function(filter) {
        return filter.fromBlock.lessThanOrEqualTo(this.currentBlockNum) &&
          (filter.toBlock == 'latest' ||
           filter.toBlock.greaterThanOrEqualTo(this.currentBlockNum));
      }).bind(this))
      .each(function(filter) {
        var entries = logs;
        if (filter.address || filter.topics.length > 0) {
          entries = _.filter(entries, function(log) {
            return (!filter.address || filter.address === log.address) &&
              (filter.topics.length == 0 || matchTopics(filter.topics, log.topics));
          });
        }
        Array.prototype.push.apply(filter.entries, entries);
      })
      .value();

    function matchTopics(filterTopics, logTopics) {
      return filterTopics.length == logTopics.length &&
        _.every(filterTopics, function(topic, index) {
          return topic === '' || topic === logTopics[index];
        });
    }
  },
  newPendingTx: function(tx) {
    var hash = tx.hash();
    _(this.filters)
      .filter({type: 'pending'})
      .each(function(filter) {
        filter.entries.push(hash);
      })
      .value();
  },
  removeFilter: function(id) {
    if (this.filters.hasOwnProperty(id)) delete this.filters[id];
  },
  getChanges: function(id) {
    var entries = [];
    if (this.filters.hasOwnProperty(id)) {
      entries = this.filters[id].entries;
      Array.prototype.push.apply(this.filters[id].sent, entries);
      this.filters[id].entries = [];
    }
    return entries;
  },
  getEntries: function(id) {
    var entries = [];
    if (this.filters.hasOwnProperty(id)) {
      Array.prototype.push.apply(this.filters[id].sent, this.filters[id].entries);
      this.filters[id].entries = [];
      entries = this.filters[id].sent;
    }
    return entries;
  }
};

module.exports = Filters;
