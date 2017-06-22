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

var COMPORT = '/dev/ttyUSB1';

var logger = require('logops');
logger.setLevel('DEBUG');
var SerialPort = require('serialport');
var nmea0183 = require('./nmea0183');
var request = require('request');
var parser = nmea0183();

var port = new SerialPort(COMPORT, {
  baudRate: 57600
});

port.on('open', function() {
    logger.info('serial port opened');
});

port.on('data', function (data) {
    data = data.toString();
    for (var i = 0; i < data.length; i++) {
        var result = parser.consume(data.charAt(i));
        if (result.complete && result.success) {
            var data = result.message
                .split(',')
                .map(p => p.split('='))
                .reduce((o, p) => (o[p[0]] = p[1], o), {});

            var raindata = { 'Type': 'RainTrigger', 'Data': {}};
            raindata.Rain = parseInt(data.RAIN);
            raindata.Intensity = parseInt(data.INTENSITY);

            var interiordata = { 'Type': 'Interior', 'Data': {}};
            interiordata.EnclosureTemp = [ parseFloat(data.ENCLOSURETEMP), 'C' ];
            interiordata.InteriorTemp = [ parseFloat(data.INTERIORTEMP), 'C' ];
            interiordata.InteriorHumidity = [ parseFloat(data.INTERIORHUMIDITY), '%' ];
            interiordata.InteriorPressure = [ parseInt(data.INTERIORPRESSURE)/100.0, 'hPa' ];

            console.log(JSON.stringify(raindata));
            request.post({
                url: 'http://localhost:9001/api',
                body: raindata,
                json: true
            });

            console.log(JSON.stringify(interiordata));
            request.post({
                url: 'http://localhost:9001/api',
                body: interiordata,
                json: true
            });
        }
    }
});
