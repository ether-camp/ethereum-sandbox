var solc = require('solc');
var _ = require('lodash');

var Compiler = {
  compile: function(source, cb) {
    var output = solc.compile({ sources: { 'contract.sol': source } }, 1);
    cb(
      output.errors,
      _(output.contracts)
        .map(function(details, name) {
          return [ name, {
            code: '0x' + details.bytecode,
            info: {
              source: source,
              abiDefinition: JSON.parse(details.interface),
              userDoc: { methods: {} },
              developerDoc: { methods: {} }
            }
          }];
        })
        .object()
        .value()
    );
  }
};

module.exports = Compiler;
