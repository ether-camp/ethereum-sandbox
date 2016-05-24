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
    },
    obfuscator: {
      files: [
        'app.js',
        'compiler.js',
        'plugins.js',
        'sandbox_control.js',
        'util.js',
        'api/*.js',
        'ethereum/*.js',
        'sandbox/*.js',
        'types/*.js'
      ],
      entry: 'app.js',
      out: 'ethereum-sandbox.js',
      strings: true,
      root: __dirname
    }
  });

  grunt.loadNpmTasks('grunt-run');
  grunt.loadNpmTasks('grunt-simple-mocha');
  grunt.loadNpmTasks('grunt-obfuscator');

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
