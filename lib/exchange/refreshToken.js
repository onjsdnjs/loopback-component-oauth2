/**
 * Module dependencies.
 */
var utils = require('../utils')
  , AuthorizationError = require('../errors/authorizationerror');


/**
 * Refresh previously issued access tokens.
 *
 * References:
 *  - [Refreshing an Access Token](http://tools.ietf.org/html/draft-ietf-oauth-v2-26#section-6)
 *
 * @param {Object} options
 * @param {Function} issue
 * @api public
 */
module.exports = function refreshToken(options, issue) {
  if (typeof options == 'function') {
    issue = options;
    options = null;
  }
  options = options || {};
  
  if (!issue) throw new Error('OAuth 2.0 refreshToken exchange middleware requires an issue function.');
  
  var userProperty = options.userProperty || 'user';

  // For maximum flexibility, multiple scope spearators can optionally be
  // allowed.  This allows the server to accept clients that separate scope
  // with either space or comma (' ', ',').  This violates the specification,
  // but achieves compatibility with existing client libraries that are already
  // deployed.
  var separators = options.scopeSeparator || ' ';
  if (!Array.isArray(separators)) {
    separators = [ separators ];
  }

  return function refresh_token(req, res, next) {
    if (!req.body) { return next(new Error('Request body not parsed. Use bodyParser middleware.')); }
    
    // The 'user' property of `req` holds the authenticated user.  In the case
    // of the token endpoint, the property will contain the OAuth 2.0 client.
    var client = req[userProperty]
      , refreshToken = req.body['refresh_token']
      , scope = req.body['scope'];
      
    if (!refreshToken) { return next(new AuthorizationError('missing refresh_token parameter', 'invalid_request')); }
    
    if (scope) {
      for (var i = 0, len = separators.length; i < len; i++) {
        var separated = scope.split(separators[i]);
        // only separate on the first matching separator.  this allows for a sort
        // of separator "priority" (ie, favor spaces then fallback to commas)
        if (separated.length > 1) {
          scope = separated;
          break;
        }
      }
      if (!Array.isArray(scope)) { scope = [ scope ]; }
    }
    
    function issued(err, accessToken, refreshToken, params) {
      if (err) { return next(err); }
      if (!accessToken) { return next(new AuthorizationError('invalid refresh token', 'invalid_grant')); }
      
      var tok = {};
      tok['access_token'] = accessToken;
      if (refreshToken) { tok['refresh_token'] = refreshToken; }
      if (params) { utils.merge(tok, params); }
      tok['token_type'] = tok['token_type'] || 'bearer';
      
      var json = JSON.stringify(tok);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
      res.end(json);
    }
    
    var arity = issue.length;
    if (arity == 4) {
      issue(client, refreshToken, scope, issued);
    } else { // arity == 3
      issue(client, refreshToken, issued);
    }
  }
}