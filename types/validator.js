var _ = require('lodash');
var util = require('../util');
var parse = require('./parse');

module.exports.withValidator = function(call) {
  return function() {
    var args = arguments[0];
    var cb = util.jsonRpcCallback(arguments[1]);
    if (args.length !== call.args.length) cb('Wrong number of arguments');
    else {
      var errors = [];
      args = _.map(args, function(arg, index) {
        return parse(arg, call.args[index], errors);
      });
      args.push(cb);
      if (errors.length === 0) call.handler.apply(null, args);
      else cb(errors.join(' '));
    }
  };
};
