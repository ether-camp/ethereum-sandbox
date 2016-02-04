var util = require('../util');

module.exports = function() {
  return {
    clientVersion: {
      args: [],
      handler: function(cb) { cb(null, 'ethereum-sandbox/v0.0.1'); }
    },
    sha3: {
      args: [{ type: 'hex' }],
      handler: function(str, cb) { cb(null, util.sha3(str, 'hex')); }
    }
  };
};
