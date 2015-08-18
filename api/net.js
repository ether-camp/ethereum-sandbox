module.exports = function(sandbox) {
  return {
    version: function(cb) {
      cb(null, "59");
    },
    listening: function(cb) {
      cb(null, true);
    },
    peerCount: function(cb) {
      cb(null, "0x0");
    }
  };
};
