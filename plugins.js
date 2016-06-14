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
      fs.stat(__dirname + '/node_modules/' + dir + '/package.json', function(err) {
        cb(!err);
      });
    }
    function parsePackageJson(dir, cb) {
      fs.readFile(__dirname + '/node_modules/' + dir + '/package.json', function(err, data) {
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
