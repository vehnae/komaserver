const express = require('express');
const expressLogging = require('express-logging');
const logger = require('logops');
const bodyParser = require('body-parser');
logger.setLevel('DEBUG');
const fs = require('fs');
const redis = require('redis');
const REDIS_PORT = process.env.REDIS_PORT || 6379;

const app = express();
const redisClient = redis.createClient(REDIS_PORT);

redisClient.on("error", function (err) {
    console.log("Redis error " + err);
});

app.use(expressLogging(logger));
app.use(express.static('public'));
app.use(bodyParser.json());

function saveData(type, req, res) {
    redisClient.zadd('ptu', Date.now(), JSON.stringify(req.body), function(err, reply) {
        if (err) {
            logger.error(err);
            res.status(500).send(err);
        } else {
            res.sendStatus(200);
        }
    });
}

function sendLatestData(type, req, res) {
    // add 'since' parameter
    if (req.query.since) {
        console.log('since ' + req.query.since);
        redisClient.zrangebyscore(type, req.query.since, '+inf', 'WITHSCORES', function(err, reply) {
            if (err) {
                logger.error(err);
                res.status(500).send(err);
            } else {
                var ptus = [];
                for (var i = 0; i < reply.length/2; i++) {
                    var ptu = JSON.parse(reply[i*2]);
                    ptu.Timestamp = parseInt(reply[i*2+1]);
                    ptus.push(ptu)
                }
                res.status(200).send(ptus);
            }
        });
    } else {
        console.log('latest');
        redisClient.zrevrange(type, 0, 1, 'WITHSCORES', function(err, reply) {
            if (err) {
                logger.error(err);
                res.status(500).send(err);
            } else {
                var ptu = JSON.parse(reply[0]);
                ptu.Timestamp = parseInt(reply[1]);
                res.status(200).send(ptu);
            }
        });
    }
}

app.post('/api/ptu', function(req, res) {
    if (req.body.Type != 'PTU') {
        res.sendStatus(400);
        return;
    }

    saveData('ptu', req, res);
});

app.post('/api/wind', function(req, res) {
    if (req.body.Type != 'Wind') {
        res.sendStatus(400);
        return;
    }

    saveData('wind', req, res);
});

app.post('/api/rain', function(req, res) {
    if (req.body.Type != 'Rain') {
        res.sendStatus(400);
        return;
    }

    saveData('rain', req, res);
});

app.get('/api/ptu', function(req, res) {
    sendLatestData('ptu', req, res);
});

app.get('/api/wind', function(req, res) {
    sendLatestData('wind', req, res);
});

app.get('/api/rain', function(req, res) {
    sendLatestData('rain', req, res);
});

app.get('/api/weather', function(req, res) {
    req.memcache.get('openweathermap', function(error, result) {
        if (error) {
            logger.error('error reading memcached: ' + error + ' result: ' + result);
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

var server = app.listen(9001, function() {
    var host = server.address().address;
    var port = server.address().port;

    logger.info('koma-weather-server listening at http://%s:%s', host, port);
}).on('error', function(err) {
    logger.error(err);
});
