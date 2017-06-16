/*
 * Copyright (c) 2016 Jari Saukkonen
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

var COMPORT = '/dev/cu.wchusbserial14420';

var express = require('express');
var _ = require('underscore');
var expressLogging = require('express-logging');
var logger = require('logops');
logger.setLevel('DEBUG');
var SerialPort = require('serialport');
var app = express();
var nmea0183 = require('./nmea0183');
var parser = nmea0183();

var power = [];
for (var i = 0; i < 120; i++) {
    power.push(0);
}
var status = "";
var loglines = ['', '', ''];

var port = new SerialPort(COMPORT, {
  baudRate: 57600
});


app.get('/status', function(req, res) {
    res.json({
        power: power,
        status: status,
        log: loglines
    });
});

app.post('/open', function(req, res) {
    port.write('$OPEN*14\r\n');
    res.json({success:true});
});

app.post('/close', function(req, res) {
    port.write('$CLOSE*56\r\n');
    res.json({success:true});
});

app.post('/stop', function(req, res) {
    port.write('$STOP*18\r\n');
    res.json({success:true});
});

app.post('/setspeed/:speed', function(req, res) {
    var cmd = 'SETSPEED,' + req.params.speed;
    var sum = 0;
    for (var i = 0; i < cmd.length; i++) {
        sum = sum ^ cmd.charCodeAt(i);
    }
    var checksum = sum.toString(16).toUpperCase();
    port.write('$' + cmd + '*' + checksum + '\r\n');

    res.json({success:true});
});

app.use(express.static('public'));

port.on('open', function() {
    logger.info('serial port opened');
});

port.on('data', function (data) {
    var handlers = {
        POWER:function(args) {
            var data = args.split(',');
            for (var i = 0; i < data.length; i++) {
                power.shift();
                power.push(parseInt(data[i]));
            }
        },
        STATUS:function(args) {
            status = args;
        },
        LOG:function(args) {
            loglines.shift();
            loglines.push(args);
            logger.info(args);
        }
    };

    data = data.toString();
    for (var i = 0; i < data.length; i++) {
        var result = parser.consume(data.charAt(i));
        if (result.complete && result.success) {
            var cmd = result.message.substring(0, result.message.indexOf(','));
            if (handlers[cmd])
                handlers[cmd](result.message.substring(result.message.indexOf(',')+1));
        }
    }
});

var server = app.listen(9000, function() {
    var host = server.address().address;
    var port = server.address().port;

    logger.info('listening at http://%s:%s', host, port);
}).on('error', function(err) {
    logger.error('on error handler');
    logger.error(err);
});
