var spawn = require('child_process').spawn;
var jayson = require('jayson');
var http = require('http');
var urlparser = require('url');
var _ = require('lodash');
var async = require('async');
var web3 = require('web3');

var baseUrl = 'http://localhost:8555/',
    sandboxUrl = baseUrl + 'sandbox/';

var EMPTY_CONTRACT = '6060604052600a8060116000396000f30060606040526008565b00';
var CONTRACT_WITH_LOG = '606060405260808060116000396000f30060606040526000357c010000000000000000000000000000000000000000000000000000000090048063b0bea725146037576035565b005b60406004506042565b005b7f686579000000000000000000000000000000000000000000000000000000000060016040518082600102815260200191505060405180910390a15b56';
var CONTRACT_WITH_LOG_CALLME = 'b0bea725';

web3._extend({
  property: 'sandbox',
  methods: [
    new web3._extend.Method({
      name: 'createAccounts',
      call: 'sandbox_createAccounts',
      params: 1
    }),
    new web3._extend.Method({
      name: 'setBlock',
      call: 'sandbox_setBlock',
      params: 1
    }),
    new web3._extend.Method({
      name: 'predefinedAccounts',
      call: 'sandbox_predefinedAccounts',
      params: 0
    }),
    new web3._extend.Method({
      name: 'accounts',
      call: 'sandbox_accounts',
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
  beforeAll(function(done) {
    this.app = spawn('node', ['app.js']);
    this.app.on('error', function(err) {
      console.error(err);
      done.fail();
    });
    this.app.stdout.on('data', function(data) {
      if (_.startsWith(data.toString(), 'Sandbox is listening')) done();
      else console.log(data.toString());
    });
    this.app.stderr.on('data', function(data) {
      var err = data.toString();
      console.log(err);
      done.fail(err);
    });
  });

  afterAll(function() {
    this.app.kill();
  });

  afterEach(function() {
    request('POST', baseUrl + 'reset', function(){});
  });

  it('Creates a new sandbox', function(done) {
    request('POST', sandboxUrl, function(err, res, reply) {
      if (err) return done.fail(err);
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toStartWith('application/json');
      expect(reply).toHaveNonEmptyString('id');
      done();
    });
  });

  it('Provides list of active sandboxes', function(done) {
    createSandbox(function(err, id) {
      if (err) return done.fail(err);
      request('GET', sandboxUrl, function(err, res, reply) {
        if (err) return done.fail(err);
        expect(res.statusCode).toBe(200);
        expect(reply).toBeArrayOfSize(1);
        expect(reply).toContain(id);
        done();
      });
    });
  });

  it('Stoppes a sandbox', function(done) {
    async.waterfall([
      createSandbox,
      check,
      stop,
      check
    ], done);
    
    function check(id, cb) {
      request('GET', sandboxUrl, function(err, res, reply) {
        if (err) return cb(err);
        expect(res.statusCode).toBe(200);
        if (id) {
          expect(reply).toBeArrayOfSize(1);
          expect(reply).toContain(id);
        } else {
          expect(reply).toBeArrayOfSize();
        }
        cb(null, id);
      });
    }
    function stop(id, cb) {
      request('DELETE', sandboxUrl + id, function(err, res) {
        if (err) return cb(err);
        expect(res.statusCode).toBe(200);
        cb();
      });
    }
  });
  
  it('Route messages to sandboxes by id', function(done) {
    async.parallel([
      createSandbox,
      createSandbox
    ], function (err, ids) {
      async.each(ids, function(id, cb) {
        var client = jayson.client.http(sandboxUrl + id);
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
      web3.setProvider(new web3.providers.HttpProvider(sandboxUrl + id));
      try {
        expect(web3.sandbox.id).toBe(id);
      } catch (e) {
        return done.fail(e);
      }
      done();
    });
  });

  it('Handle sandbox_createAccounts call', function(done) {
    createSandbox(function(err, id) {
      if (err) return done.fail(err);
      web3.setProvider(new web3.providers.HttpProvider(sandboxUrl + id));
      try {
        web3.sandbox.createAccounts({
          'dedb49385ad5b94a16f236a6890cf9e0b1e30392': {
            pkey: 'secret',
            default: true
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
    var predefinedAccounts = {
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
      web3.setProvider(new web3.providers.HttpProvider(sandboxUrl + id));
      try {
        async.series([
          web3.sandbox.createAccounts.bind(null, predefinedAccounts),
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

  it('Handle sandbox_predefinedAccounts call', function(done) {
    var predefinedAccounts = {
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
    };
    var expectedAccounts = {
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
      web3.setProvider(new web3.providers.HttpProvider(sandboxUrl + id));
      try {
        async.series([
          web3.sandbox.createAccounts.bind(null, predefinedAccounts),
          web3.sandbox.predefinedAccounts
        ], function(err, results) {
          if (err) return done.fail(err);
          expect(_.isEqual(expectedAccounts, results[1])).toBeTrue();
          done();
        });
      } catch (e) {
        done.fail(e);
      }
    });
  });

  it('Handle sandbox_runTx call', function(done) {
    var predefinedAccounts = {
      'dedb49385ad5b94a16f236a6890cf9e0b1e30392': {
        pkey: '974f963ee4571e86e5f9bc3b493e453db9c15e5bd19829a4ef9a790de0da0015',
        balance: '10000000000000',
        default: true
      }
    };
    createSandbox(function(err, id) {
      if (err) return done.fail(err);
      web3.setProvider(new web3.providers.HttpProvider(sandboxUrl + id));
      try {
        async.series([
          web3.sandbox.createAccounts.bind(null, predefinedAccounts),
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
    var predefinedAccounts = {
      'dedb49385ad5b94a16f236a6890cf9e0b1e30392': {
        pkey: '974f963ee4571e86e5f9bc3b493e453db9c15e5bd19829a4ef9a790de0da0015',
        balance: '10000000000000',
        default: true
      }
    };
    createSandbox(function(err, id) {
      if (err) return done.fail(err);
      web3.setProvider(new web3.providers.HttpProvider(sandboxUrl + id));
      try {
        async.series([
          web3.sandbox.createAccounts.bind(null, predefinedAccounts),
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

  it('Notify about all log entries', function(done) {
    var predefinedAccounts = {
      'dedb49385ad5b94a16f236a6890cf9e0b1e30392': {
        pkey: '974f963ee4571e86e5f9bc3b493e453db9c15e5bd19829a4ef9a790de0da0015',
        balance: '10000000000000',
        default: true
      }
    };
    createSandbox(function(err, id) {
      if (err) return done.fail(err);
      web3.setProvider(new web3.providers.HttpProvider(sandboxUrl + id));
      try {
        async.series([
          web3.sandbox.createAccounts.bind(null, predefinedAccounts),
          setupFilter,
          web3.sandbox.runTx.bind(null, {
            from: 'dedb49385ad5b94a16f236a6890cf9e0b1e30392',
            data: CONTRACT_WITH_LOG
          }),
          web3.sandbox.runTx.bind(null, {
            from: 'dedb49385ad5b94a16f236a6890cf9e0b1e30392',
            to: '86e0497e32a8e1d79fe38ab87dc80140df5470d9',
            data: CONTRACT_WITH_LOG_CALLME
          })
        ], function(err) {
          if (err) return done.fail(err);
        });
      } catch (e) {
        done.fail(e);
      }

      function setupFilter(cb) {
        var filter = web3.eth.filter({});
        filter.watch(function(err, result) {
          if (err) return done.fail(err);
          expect(result).toHaveNonEmptyString('address');
          expect(result).toHaveNonEmptyString('data');
          expect(result).toHaveArrayOfSize('topics', 1);
          done();
        });
        cb();
      }
    });
  });
});

function request(method, url, cb) {
  var options = urlparser.parse(url);
  options.method = method;
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
  request('POST', sandboxUrl, function(err, res, reply) {
    if (err) cb(err);
    else cb(null, reply.id);
  });
}
