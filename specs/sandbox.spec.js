var spawn = require('child_process').spawn;
var jayson = require('jayson');
var http = require('http');
var urlparser = require('url');
var _ = require('lodash');

require('jasmine-expect');

describe('Sandbox', function() {
  var app;
  
  beforeAll(function(done) {
    app = spawn('node', ['app.js']);
    app.on('error', function(err) {
      console.error(err);
      done.fail();
    });
    app.stdout.on('data', function(data) {
      if (_.startsWith(data.toString(), 'Sandbox is listening')) done();
    });
    app.stderr.on('data', function(data) {
      var err = data.toString();
      console.log(err);
      done.fail(err);
    });
  });

  afterAll(function() {
    app.kill();
  });

  it('Create a new sandbox', function(done) {
    post('http://localhost:8545/create-sandbox', function(err, res, reply) {
      if (err) return done.fail(err);
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toStartWith('application/json');
      expect(reply).toHaveNonEmptyString('id');
      done();
    });
  });

  it('Echoes', function(done) {
    var phrase = 'I am the one who knocks!';
    var client = jayson.client.http('http://localhost:8545');
    client.request('echo', [phrase], function(err, reply) {
      if (err) done.fail(err);
      expect(reply.result).toBe(phrase);
      done();
    });
  });
});

function post(url, cb) {
  var options = urlparser.parse(url);
  options.method = 'POST';
  var req = http.request(options, function(res) {
    var body = '';
    res.on('data', function(chunk) { body += chunk; });
    res.on('end', function() {
      try {
        var reply = JSON.parse(body);
      } catch (e) {
        return cb(e);
      }
      cb(null, res, reply);
    });
  });
  req.on('error', cb);
  req.end();
}
