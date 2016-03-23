var fs = require('fs');
var async = require('async');
var _ = require('lodash');

function load(events) {
  fs.readdir(__dirname + '/node_modules', function(err, dirs) {
    if (err) return console.error(err);
    
    async.waterfall([
      function(cb) { async.filter(dirs, hasPackageJson, _.partial(cb, null)); },
      _.partial(async.map, _, parsePackageJson, _),
      function(params, cb) { async.filter(params, hasPluginField, _.partial(cb, null)); },
      _.partial(async.map, _, loadPlugin, _)
    ], function(err, plugins) {
      if (err) return console.error(err);
    });

    function hasPackageJson(dir, cb) {
      fs.stat('./node_modules/' + dir + '/package.json', function(err) {
        cb(!err);
      });
    }
    function parsePackageJson(dir, cb) {
      fs.readFile('./node_modules/' + dir + '/package.json', function(err, data) {
        if (err) return cb(err);
        try {
          cb(null, JSON.parse(data));
        } catch (e) {
          cb(e);
        }
      });
    }
    function hasPluginField(params, cb) {
      cb(params.hasOwnProperty('ethereumSandboxPlugin'));
    }
    function loadPlugin(params, cb) {
      cb(null, [
        params.ethereumSandboxPlugin,
        require(params.name).create(events)
      ]);
    }
  });
}

module.exports = {
  load: load
};
