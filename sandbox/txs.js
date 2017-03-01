var _ = require('lodash');

var Txs  = {
  init: function() {
    this.entries = [];
    return this;
  },
  add: function(tx) {
    this.entries.push({
      tx: tx,
      status: 'pending'
    });
  },
  hasPending: function() {
    return _.any(this.entries, { status: 'pending' });
  },
  getLatest: function(from) {
    var entry = _.findLast(this.entries, { tx: { from: from }});
    return entry ? entry.tx : null;
  },
  getPendingTxs: function(gas) {
    return _(this.entries)
      .where({ status: 'pending' })
      .takeWhile(function(entry) {
        gas = gas.sub(entry.tx.gasLimit);
        return !gas.isNegative();
      })
      .map('tx')
      .value();
  },
  mining: function(txs) {
    this._setStatus(txs, 'mining');
  },
  mined: function(txs) {
    this._setStatus(txs, 'mined');
  },
  _getEntries: function(txs) {
    return _.filter(this.entries, function(entry) {
      return _.any(txs, { from: entry.tx.from, nonce: entry.tx.nonce });
    });
  },
  _setStatus: function(txs, status) {
    _.each(this._getEntries(txs), function(e) { e.status = status; });
  }
};

module.exports = Txs;
