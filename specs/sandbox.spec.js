var spawn = require('child_process').spawn;
var jayson = require('jayson');
var http = require('http');
var urlparser = require('url');

require('jasmine-expect');

describe('Sandbox', function() {
  var client;
  
  beforeAll(function(done) {
    var app = spawn('node', ['app.js'], { detached: true });
    app.stdout.on('data', function(data) {
      if (data.toString().indexOf('Sandbox is listening') !== -1) {
        client = jayson.client.http('http://localhost:8545');
        done();
      }
    });
    app.stderr.on('data', function(data) {
      done.fail(console.log(data.toString()));
    });
  });

  it('Create a new sandbox', function(done) {
    request('http://localhost:8545/create-sandbox', function(err, res, reply) {
      if (err) return done.fail(err);
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toStartWith('application/json');
      expect(reply).toHaveNonEmptyString('id');
      done();
    });
  });

  it('Echoes', function(done) {
    var phrase = 'I am the one who knocks!';
    client.request('echo', [phrase], function(err, reply) {
      if (err) done.fail(err);
      expect(reply.result).toBe(phrase);
      done();
    });
  });
});

function request(url, cb) {
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
