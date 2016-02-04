module.exports = function() {
  return {
    version: { args: [], handler: function(cb) { cb(null, "59"); } },
    listening: { args: [], handler: function(cb) { cb(null, true); } },
    peerCount: { args: [], handler: function(cb) { cb(null, "0x0"); } }
  };
};
