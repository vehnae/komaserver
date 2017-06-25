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

const COMPORT = '/dev/ttyUSB0';

const logger = require('logops');
logger.setLevel('DEBUG');
const SerialPort = require('serialport');
const port = new SerialPort(COMPORT, { baudRate: 57600 });
const nmea0183 = require('./nmea0183');
const parser = nmea0183();

var power = [];
for (var i = 0; i < 120; i++) {
    power.push(0);
}
var status = "";
var loglines = ['', '', ''];
var stateCallback;

module.exports = {
    open: () => {
        port.write('$OPEN*14\r\n');
    },
    close: () => {
        port.write('$CLOSE*56\r\n');
    },
    stop: () => {
        port.write('$STOP*18\r\n');
    },
    state: () => {
        return currentState;
    },
    setStateCallback: (callback) => {
        stateCallback = callback;
    }
    powerusage: () => {
        return power;
    },
    statusline: () => {
        return status;
    },
    loglines: () => {
        return loglines;
    }
}

port.on('open', function() {
    logger.info('serial port opened');
});

port.on('data', function (data) {
    var handlers = {
        POWER:function(args) {
            logger.info(args);
            var data = args.split(',');
            for (var i = 0; i < data.length; i++) {
                power.shift();
                power.push(parseInt(data[i]));
            }
        },
        STATUS:function(args) {
            status = args;
            var data = args.split(',')
                .map((arg) => arg.split('='))
                .reduce((ob, p) => { ob[p[0]] = p[1], ob }, {});
            if (currentState != data['ROOF'] && stateCallback) {
                stateCallback(data['ROOF']);
            }
            currentState = data['ROOF'];
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
            else
                logger.info('unknown command ' + result.message);
        }
    }
});
