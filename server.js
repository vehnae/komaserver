var express = require('express');
var _ = require('underscore');
var memcache = require('memcache');
var app = express();

app.all('*', function(req, res, next) {
    client = new memcache.Client(11211, 'localhost');
    client.connect();
    req.memcache = client;
    next();
});

app.get('/weather', function(req, res) {
    req.memcache.get('openweathermap', function(error, result) {
        if (error) {
            console.log('error reading memcached: ' + error + ' result: ' + result);
            return res.status(500).end();
        }

        var weatherdata = JSON.parse(result);
        var data = {
            temperature: weatherdata.main.temp,
            humidity: weatherdata.main.humidity,
            pressure: weatherdata.main.pressure,
            windspeed: weatherdata.wind.speed,
            winddir: weatherdata.wind.deg,
            clouds: weatherdata.clouds.all
        };
        res.json(data);
    });
});

app.get('/safe', function(req, res) {

    // luetaan rajakytkimet, sääasemat sun muut härpättimet josta tila selviää
    var safe = true;

    res.json({
        safe: safe
    });
});

app.param('user', function(req, res, next, user) {
    req.user = user;
    next();
});

app.all('/roof/*', function(req, res, next) {
    req.memcache.get('roof-state', function(error, result) {
        req.roofstate = JSON.parse(result) ||  {};
        var state = _.clone(req.roofstate);
        console.log('roof state before: ' + JSON.stringify(req.roofstate));
        next();
        console.log('roof state after: ' + JSON.stringify(req.roofstate));
        if (!_.isEqual(req.roofstate, state)) {
            console.log('roof state was modified');
            req.memcache.set('roof-state', JSON.stringify(req.roofstate));
        }
    });
});

app.get('/roof/:user', function(req, res) {
    res.json({
        open: req.roofstate[req.user]
    });
});

app.post('/roof/:user/open', function(req, res) {
    if (_.every(_.values(req.roofstate), function(v, index) { 
            return v == false;
        })) {
        console.log('open physical roof');
    }

    req.roofstate[req.user] = true;
    res.status(200).send('OK');
});

app.post('/roof/:user/close', function(req, res) {
    var roofopen = _.any(_.values(req.roofstate), function(v, index) { 
        return v == true;
    });
    req.roofstate[req.user] = false;
    if (roofopen && _.every(_.values(req.roofstate), function(v, index) { 
            return v == false;
        })) {
        console.log('close physical roof');
    }
    res.status(200).send('OK');
});

var server = app.listen(9000, function() {
    var host = server.address().address;
    var port = server.address().port;

    console.log('komaserver listening at http://%s:%s', host, port);
});
