var spawn = require('child_process').spawn;
var jayson = require('jayson');
var http = require('http');
var urlparser = require('url');
var _ = require('lodash');
var async = require('async');
var web3 = require('web3');

var EMPTY_CONTRACT = '60606040525b33600060006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908302179055505b600a80603e6000396000f30060606040526008565b00';// '6060604052600a8060116000396000f30060606040526008565b00';

web3._extend({
  property: 'sandbox',
  methods: [
    new web3._extend.Method({
      name: 'start',
      call: 'sandbox_start',
      params: 1
    }),
    new web3._extend.Method({
      name: 'accounts',
      call: 'sandbox_accounts',
      params: 0
    }),
    new web3._extend.Method({
      name: 'env',
      call: 'sandbox_env',
      params: 0
    }),
    new web3._extend.Method({
      name: 'runTx',
      call: 'sandbox_runTx',
      params: 1
    })
  ],
  properties: [
    new web3._extend.Property({
      name: 'id',
      getter: 'sandbox_id'
    })
  ]
});

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
      else console.log(data.toString());
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
  
  it('Handle net_version call', function(done) {
    async.waterfall([
      createSandbox,
      call
    ], function(err, reply) {
      if (err) return done.fail(err);
      expect(reply.result).toMatch(/^\d+$/);
      done();
    });

    function call(id, cb) {
      var client = jayson.client.http('http://localhost:8545/' + id);
      client.request('net_version', [], cb);
    }
  });

  it('Route messages to sandboxes by id', function(done) {
    async.parallel([
      createSandbox,
      createSandbox
    ], function (err, ids) {
      async.each(ids, function(id, cb) {
        var client = jayson.client.http('http://localhost:8545/' + id);
        client.request('sandbox_id', [], function(err, reply) {
          if (err) return cb(err);
          expect(reply.result).toBe(id);
          cb();
        });
      }, function(err) {
        if (err) done.fail(err);
        else done();
      });
    });
  });

  it('Handle sandbox_id call', function(done) {
    createSandbox(function(err, id) {
      if (err) return done.fail(err);
      web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545/' + id));
      try {
        expect(web3.sandbox.id).toBe(id);
      } catch (e) {
        return done.fail(e);
      }
      done();
    });
  });

  it('Handle sandbox_start call', function(done) {
    createSandbox(function(err, id) {
      if (err) return done.fail(err);
      web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545/' + id));
      try {
        web3.sandbox.start({
          accounts: {
            'dedb49385ad5b94a16f236a6890cf9e0b1e30392': {
              pkey: 'secret',
              default: true
            }
          }
        }, function(err, reply) {
          if (err) done.fail(err);
          else done(err);
        });
      } catch (e) {
        done.fail(e);
      }
    });
  });

  it('Handle sandbox_accounts call', function(done) {
    var env = {
      accounts: {
        'dedb49385ad5b94a16f236a6890cf9e0b1e30392': {
          pkey: '974f963ee4571e86e5f9bc3b493e453db9c15e5bd19829a4ef9a790de0da0015',
          balance: '1234',
          nonce: '62',
          default: true
        },
        '5e0d1ad9d5849c1a5c204dfb58a1e4f390a24337': {
          balance: '012345',
          nonce: 0
        }
      }
    };
    var expectedAccounts = {
      'dedb49385ad5b94a16f236a6890cf9e0b1e30392': {
        balance: '1234',
        nonce: '62',
        storage: {},
        code: ''
      },
      '5e0d1ad9d5849c1a5c204dfb58a1e4f390a24337': {
        balance: '012345',
        nonce: '',
        storage: {},
        code: ''
      }
    };
    createSandbox(function(err, id) {
      if (err) return done.fail(err);
      web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545/' + id));
      try {
        async.series([
          web3.sandbox.start.bind(null, env),
          web3.sandbox.accounts
        ], function(err, results) {
          if (err) return done.fail(err);
          var accounts = results[1];
          expect(_.size(accounts)).toBe(_.size(expectedAccounts));
          _.each(expectedAccounts, function(account, address) {
            expect(accounts).toHaveMember(address);
            expect(_.isEqual(expectedAccounts[address], account)).toBeTrue();
          });
          done();
        });
      } catch (e) {
        done.fail(e);
      }
    });
  });

  it('Handle sandbox_env call', function(done) {
    var env = {
      accounts: {
        'dedb49385ad5b94a16f236a6890cf9e0b1e30392': {
          pkey: '974f963ee4571e86e5f9bc3b493e453db9c15e5bd19829a4ef9a790de0da0015',
          balance: '1234',
          nonce: '62',
          default: true
        },
        '5e0d1ad9d5849c1a5c204dfb58a1e4f390a24337': {
          balance: '012345',
          nonce: 0
        }
      }
    };
    var expectedEnv = {
      'dedb49385ad5b94a16f236a6890cf9e0b1e30392': {
        address: 'dedb49385ad5b94a16f236a6890cf9e0b1e30392',
        pkey: '974f963ee4571e86e5f9bc3b493e453db9c15e5bd19829a4ef9a790de0da0015',
        nonce: 98
      },
      '5e0d1ad9d5849c1a5c204dfb58a1e4f390a24337': {
        address: '5e0d1ad9d5849c1a5c204dfb58a1e4f390a24337',
        pkey: null,
        nonce: 0
      }
    };
    createSandbox(function(err, id) {
      if (err) return done.fail(err);
      web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545/' + id));
      try {
        async.series([
          web3.sandbox.start.bind(null, env),
          web3.sandbox.env
        ], function(err, results) {
          if (err) return done.fail(err);
          expect(_.isEqual(expectedEnv, results[1])).toBeTrue();
          done();
        });
      } catch (e) {
        done.fail(e);
      }
    });
  });

  it('Handle sandbox_runTx call', function(done) {
    var env = {
      accounts: {
        'dedb49385ad5b94a16f236a6890cf9e0b1e30392': {
          pkey: '974f963ee4571e86e5f9bc3b493e453db9c15e5bd19829a4ef9a790de0da0015',
          balance: '10000000000000',
          default: true
        }
      }
    };
    createSandbox(function(err, id) {
      if (err) return done.fail(err);
      web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545/' + id));
      try {
        async.series([
          web3.sandbox.start.bind(null, env),
          web3.sandbox.runTx.bind(null, {
            from: 'dedb49385ad5b94a16f236a6890cf9e0b1e30392',
            data: EMPTY_CONTRACT
          }),
          web3.sandbox.accounts
        ], function(err, results) {
          if (err) return done.fail(err);
          expect(results[1]).toHaveMember('returnValue');
          expect(_.size(results[2])).toBeGreaterThan(1);
          done();
        });
      } catch (e) {
        done.fail(e);
      }
    });
  });

  it('Notifies about a pending transaction', function(done) {
    var env = {
      accounts: {
        'dedb49385ad5b94a16f236a6890cf9e0b1e30392': {
          pkey: '974f963ee4571e86e5f9bc3b493e453db9c15e5bd19829a4ef9a790de0da0015',
          balance: '10000000000000',
          default: true
        }
      }
    };
    createSandbox(function(err, id) {
      if (err) return done.fail(err);
      web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545/' + id));
      try {
        async.series([
          web3.sandbox.start.bind(null, env),
          setupFilter,
          web3.sandbox.runTx.bind(null, {
            from: 'dedb49385ad5b94a16f236a6890cf9e0b1e30392',
            value: '01'
          })
        ], function(err) {
          if (err) return done.fail(err);
        });
      } catch (e) {
        done.fail(e);
      }

      function setupFilter(cb) {
        var filter = web3.eth.filter('pending');
        filter.watch(function(err, result) {
          expect(result).toBeString();
          done();
        });
        cb();
      }
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

function createSandbox(cb) {
  post('http://localhost:8545/create-sandbox', function(err, res, reply) {
    if (err) cb(err);
    else cb(null, reply.id);
  });
}
