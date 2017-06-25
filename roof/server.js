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

const express = require('express');
const _ = require('underscore');
const expressLogging = require('express-logging');
const logger = require('logops');
logger.setLevel('DEBUG');
const fs = require('fs');
const redis = require('redis');
const roofmotor = require('./roofmotor');
roofMotor.setStateCallback(roofCallback);

const app = express();
app.use(expressLogging(logger));

const REDIS_PORT = process.env.REDIS_PORT || 6379;
const redisClient = redis.createClient(REDIS_PORT);

var roofState = "STOPPED";

redisClient.on("error", function(err) {
    console.log("Redis error: " + err);
});

function roofCallback(state) {
    switch (state) {
        case "STOPPED": break;
        case "OPEN": {
            redisClient.get('roof-state', function(error, result) {
               roofstate = JSON.parse(result);
               roofstate.openRequestedBy.forEach((user) => { roofstate.users[user] = true });
               roofstate.openRequestedBy = [];
               logger.debug('roof state changed: ' + JSON.stringify(roofstate));
               redisClient.set('roof-state', JSON.stringify(roofstate));
           });
           break;
        }

        case "CLOSED": {
            redisClient.get('roof-state', function(error, result) {
                roofstate = JSON.parse(result);
                roofstate.users[req.user] = false;
                logger.debug('roof state changed: ' + JSON.stringify(roofstate));
                redisClient.set('roof-state', JSON.stringify(roofstate));
            });
            break;
        }
        case "OPENING": break;
        case "CLOSING": break;
        case "STOPPING": break;
        case "ERROR": break;
        break;
    }

    roofState = state;
}

app.param('user', function(req, res, next, user) {
    req.user = user;
    next();
});

app.all('/roof/*', function(req, res, next) {
     redisClient.get('roof-state', function(error, result) {
        if (error) {
            logger.error('error reading redis: ' + error + ' result: ' + result);
            return res.status(500).end();
        }
        req.roofstate = JSON.parse(result) || { opening:false, closing:false, openRequestedBy:[], users:{} };
        var state = JSON.stringify(req.roofstate);
        next();
        var newState = JSON.stringify(req.roofstate);
        if (!_.isEqual(newState, state)) {
            logger.debug('roof state changed: ' + newState);
            redisClient.set('roof-state', newState);
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
        req.roofstate.openRequestedBy.push(req.user);
        if (!req.roofstate.opening) {
            logger.info('open physical roof');
            roofMotor.open();
            req.roofstate.opening = true;
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
    remove(req.roofstate.openRequestedBy, req.user);
    if (roofopen && !otherusers && !req.roofstate.closing) {
        logger.info('close physical roof');
        roofMotor.close();
        req.roofstate.closing = true;
        setTimeout(function() {
        }, 5000);
    }
    else {
        // no need to move roof, just mark as closed unless we are opening
        if (!req.roofstate.opening)
            req.roofstate.users[req.user] = false;
    }
    res.status(200).send('OK');
});


app.get('/motor/status', function(req, res) {
    res.json({
        power: roofmotor.powerusage(),
        status: roofmotor.statusline(),
        log: roofmotor.loglines()
    });
});

app.post('/motor/open', function(req, res) {
    roofmotor.open();
    res.json({success:true});
});

app.post('/motor/close', function(req, res) {
    roofmotor.close();
    res.json({success:true});
});

app.post('/motor/stop', function(req, res) {
    roofmotor.stop();
    res.json({success:true});
});

app.use(express.static('public'));

var server = app.listen(9000, function() {
    var host = server.address().address;
    var port = server.address().port;

    logger.info('koma-roof-server listening at http://%s:%s', host, port);
}).on('error', function(err) {
    logger.error('on error handler');
    logger.error(err);
});
