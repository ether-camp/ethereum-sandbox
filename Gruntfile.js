module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    run: {
      app: {
        options: {
          wait: false,
          ready: /Sandbox is listening at/
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
