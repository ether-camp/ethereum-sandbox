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
 
module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    run: {
      app: {
        options: {
          wait: false
        },
        cmd: 'node',
        args: ['app.js']
      }
    },
    simplemocha: {
      control: { src: ['specs/sandbox-control.spec.js'] },
      jsonRpc: { src: ['specs/sandbox-json-rpc.spec.js'] }
    }
  });

  grunt.loadNpmTasks('grunt-run');
  grunt.loadNpmTasks('grunt-simple-mocha');

  grunt.registerTask('simplemochaGrep', function() {
    grunt.config('simplemocha.options.grep', grunt.option('grep'));
    grunt.task.run('simplemocha');
  });

  grunt.registerTask('test', [
    'run:app',
    'simplemochaGrep',
    'stop:app'
  ]);
  grunt.registerTask('default', []);
};
