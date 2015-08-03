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

  grunt.registerTask('test', [
    'run:app',
    'simplemocha',
    'stop:app'
  ]);
  grunt.registerTask('default', []);
};
