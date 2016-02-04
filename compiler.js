var childProcess = require('child_process');
var _ = require('lodash');

var Compiler = {
  compile: function(source, cb) {
    var solc = childProcess.spawn('solc', ['--combined-json', 'bin,abi,devdoc,userdoc']);
    var out = '', err = '';
    solc.stdout.on('data', function(data) {
      out += data.toString();
    });
    solc.stdout.on('end', done);
    solc.stderr.on('data', function(data) {
      err += data.toString();
    });
    solc.stderr.on('end', done);
    
    solc.stdin.end(source, 'utf8');
    
    var calls = 0;
    function done() {
      if (++calls != 2) return;
      if (err) return cb(err);
      try {
        var parsed = JSON.parse(out);
      } catch (e) {
        return cb(out);
      }
      cb(null, _(parsed.contracts).transform(function (result, info, name) {
        result[name] = {
          code: '0x' + info.bin,
          info: {
            source: source,
            abiDefinition: JSON.parse(info.abi),
            userDoc: JSON.parse(info.userdoc),
            developerDoc: JSON.parse(info.devdoc)
          }
        }
      }).value());
    }
  }
};

module.exports = Compiler;
