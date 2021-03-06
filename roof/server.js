/*
 * Copyright (c) 2017 Jari Saukkonen
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

var express = require('express');
var _ = require('underscore');
var memcache = require('memcache');
var expressLogging = require('express-logging');
var logger = require('logops');
logger.setLevel('DEBUG');
var fs = require('fs');

var app = express();
app.use(expressLogging(logger));
var safe = false;

app.all('*', function(req, res, next) {
    client = new memcache.Client(11211, 'localhost');
    client.connect();
    req.memcache = client;
    next();
});

app.param('user', function(req, res, next, user) {
    req.user = user;
    next();
});

app.all('/roof/*', function(req, res, next) {
    req.memcache.get('roof-state', function(error, result) {
        if (error) {
            logger.error('error reading memcached: ' + error + ' result: ' + result);
            return res.status(500).end();
        }
        req.roofstate = JSON.parse(result) || { opening:false, closing:false, openers:[], users:{} };
        var state = JSON.stringify(req.roofstate);
        next();
        var newState = JSON.stringify(req.roofstate);
        if (!_.isEqual(newState, state)) {
            logger.debug('roof state changed: ' + newState);
            req.memcache.set('roof-state', newState);
        }
    });
});

app.get('/roof/:user', function(req, res) {
    res.json({
	    open: req.roofstate.users[req.user],
	    opening: req.roofstate.opening,
        closing: req.roofstate.closing
    });
});

app.post('/roof/:user/open', function(req, res) {
    var roofopen = _.any(_.values(req.roofstate.users), function(v, index) { 
        return v == true;
    });
    if (!roofopen) {
        req.roofstate.openers.push(req.user);
        if (!req.roofstate.opening) {
            logger.info('open physical roof');
	        req.roofstate.opening = true;
	        setTimeout(function() {
	            req.memcache.get('roof-state', function(error, result) {
	                roofstate = JSON.parse(result);
		            roofstate.opening = false;
                    roofstate.openers.forEach(function(user) {
                        roofstate.users[user] = true;
                    });
                    roofstate.openers = [];
		            logger.debug('roof state changed: ' + JSON.stringify(roofstate));
		            req.memcache.set('roof-state', JSON.stringify(roofstate));
	            });
	        }, 5000);
        }
    }
    else {
	    // no need to move roof, just mark as open unless we are closing down
        if (!req.roofstate.closing)
            req.roofstate.users[req.user] = true;
    }
    res.status(200).send('OK');
});

function remove(arr, item) {
    var idx = arr.indexOf(item);
    if (idx != -1)
        arr.splice(idx, 1);
}

app.post('/roof/:user/close', function(req, res) {
    var roofopen = _.any(_.values(req.roofstate.users), function(v, index) { 
        return v == true;
    });
    var otherusers = _.any(_.mapObject(req.roofstate.users), function(open, user) { 
        return user != req.user && open;
    });
    remove(req.roofstate.openers, req.user);
    if (roofopen && !otherusers && !req.roofstate.closing) {
        logger.info('close physical roof');
	    req.roofstate.closing = true;
	    setTimeout(function() {
	        req.memcache.get('roof-state', function(error, result) {
	            roofstate = JSON.parse(result);
		        roofstate.closing = false;
                roofstate.users[req.user] = false;
	            logger.debug('roof state changed: ' + JSON.stringify(roofstate));
		        req.memcache.set('roof-state', JSON.stringify(roofstate));
	        });
	    }, 5000);
    }
    else {
	    // no need to move roof, just mark as closed unless we are opening
        if (!req.roofstate.opening)
            req.roofstate.users[req.user] = false;
    }
    res.status(200).send('OK');
});

var server = app.listen(9000, function() {
    var host = server.address().address;
    var port = server.address().port;

    updateSafety();

    logger.info('komaserver listening at http://%s:%s', host, port);
}).on('error', function(err) {
    logger.error('on error handler');
    logger.error(err);
});
