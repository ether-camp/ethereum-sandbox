var spawn = require('child_process').spawn;
var jayson = require('jayson');
var http = require('http');

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
      console.log(data.toString());
    });
    app.stderr.on('data', function(data) {
      done.fail(console.log(data.toString()));
    });
  });

  it('Create a new sandbox', function(done) {
    var req = http.request({
      host: 'localhost',
      port: '8545',
      path: '/create-sandbox',
      method: 'POST'
    }, function(res) {
      expect(res.statusCode).toBe(200);
      expect(res.headers['Content-Type']).toStartWith('application/json');
      var body;
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() {
        try {
          var reply = JSON.parse(body);
        } catch (e) {
          return done.fail(e);
        }
        expect(reply).toHaveNonEmptyString('id');
        done();
      });
    });
    req.on('error', done.fail);
    req.end();
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
