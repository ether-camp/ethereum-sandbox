module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jasmine_nodejs: {
      test: {
        specs: [ "specs/**" ]
      }
    }
  });

  grunt.loadNpmTasks('grunt-jasmine-nodejs');

  grunt.registerTask('test', ['jasmine']);
  grunt.registerTask('default', []);
};
