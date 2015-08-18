var util = require('../util');

module.exports = function(sandbox) {
  return {
    clientVersion: function(cb) {
      cb(null, 'ethereum-sandbox/v0.0.1');
    },
    sha3: function(str, cb) {
      console.log(str);
      cb(null, util.sha3(str, 'hex'));
    }
  };
};
