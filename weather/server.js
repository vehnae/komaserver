const express = require('express');
const expressLogging = require('express-logging');
const logger = require('logops');
const bodyParser = require('body-parser');
logger.setLevel('DEBUG');
const fs = require('fs');
const redis = require('redis');
const Promise = require('bluebird');
const REDIS_PORT = process.env.REDIS_PORT || 6379;

Promise.promisifyAll(redis.RedisClient.prototype);

const app = express();
const redisClient = redis.createClient(REDIS_PORT);

redisClient.on("error", function (err) {
    console.log("Redis error " + err);
});

app.use(expressLogging(logger));
app.use(express.static('public'));
app.use(bodyParser.json());

function saveData(type, req, res) {
    req.body.Timestamp = 'Timestamp' in req.body ? parseInt(req.body.Timestamp) : Date.now();
    redisClient.zadd(type, req.body.Timestamp, JSON.stringify(req.body), function(err, reply) {
        if (err) {
            logger.error(err);
            res.status(500).send(err);
        } else {
            res.sendStatus(200);
        }
    });
}

function sendLatestData(type, req, res) {
    if (req.query.since) {
        redisClient.zrangebyscore(type, req.query.since, '+inf', 'WITHSCORES', function(err, reply) {
            if (err) {
                logger.error(err);
                res.status(500).send(err);
            } else {
                var items = [];
                for (var i = 0; i < reply.length/2; i++) {
                    var data = JSON.parse(reply[i*2]);
                    data.Timestamp = parseInt(reply[i*2+1]);
                    items.push(data)
                }
                res.status(200).send(items);
            }
        });
    } else {
        redisClient.zrevrange(type, 0, 1, 'WITHSCORES', function(err, reply) {
            if (err) {
                logger.error(err);
                res.status(500).send(err);
            } else {
                var data = JSON.parse(reply[0]);
                data.Timestamp = parseInt(reply[1]);
                res.status(200).send(data);
            }
        });
    }
}

function dewpoint(humidity, temperature) {
    var a, b;
    if (temperature >= 0) {
        a = 7.5;
        b = 237.3;
    } else {
        a = 7.6;
        b = 240.7;
    }

    var sdd = 6.1078 * Math.pow(10, (a * temperature) / (b + temperature));
    var dd = sdd * (humidity / 100);
    v = Math.log(dd / 6.1078) / Math.log(10);
    return (b * v) / (a - v);
}

function cloudcover(sky, ambient) {
    // less than -5 delta => cloudy
    // more than -15 delta => clear
    // interpolate intermediate values linearly
    var cover = 100*(1.0 - (ambient-sky-5) / 10);
    if (cover < 0) return 0;
    if (cover > 100) return 100;
    return Math.round(cover);
}

app.post('/api', function(req, res) {
    if (req.body.Type == 'PTU') {
        saveData('ptu', req, res);
    } else if (req.body.Type == 'Wind') {
        saveData('wind', req, res);
    } else if (req.body.Type == 'Rain') {
        saveData('rain', req, res);
    } else if (req.body.Type == 'RainTrigger') {
        saveData('raintrigger', req, res);
    } else if (req.body.Type == 'Interior') {
        saveData('interior', req, res);
    } else if (req.body.Type == 'Status') {
        saveData('status', req, res);
    } else if (req.body.Type == 'Radar') {
        saveData('radar', req, res);
    } else if (req.body.Type == 'Cloud') {
        saveData('cloud', req, res);
    } else {
        res.sendStatus(400);
        return;
    }
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

app.get('/api/raintrigger', function(req, res) {
    sendLatestData('raintrigger', req, res);
});

app.get('/api/interior', function(req, res) {
    sendLatestData('interior', req, res);
});

app.get('/api/status', function(req, res) {
    sendLatestData('status', req, res);
});

app.get('/api/radar', function(req, res) {
    sendLatestData('radar', req, res);
});

app.get('/api/cloud', function(req, res) {
    sendLatestData('cloud', req, res);
});

app.get('/api/weather', function(req, res) {
    Promise.join(
        redisClient.zrevrangeAsync('ptu', 0 ,0),
        redisClient.zrevrangeAsync('wind', 0, 0),
        redisClient.zrevrangeAsync('rain', 0, 0),
        redisClient.zrevrangeAsync('cloud', 0, 0),

        function(...replies) {
            if (replies.find(reply => reply.length === 0)) {
                logger.error('Reading Redis failed');
                res.status(500).send('{"error":"Reading redis failed"}');
                return;
            }

            var ptu = JSON.parse(replies[0][0]),
                wind = JSON.parse(replies[1][0]),
                rain = JSON.parse(replies[2][0]),
                cloud = JSON.parse(replies[3][0]);

            var data = {
                temperature: ptu.Data.Temperature.Ambient[0],
                humidity: ptu.Data.Humidity[0],
                dewpoint: parseInt(dewpoint(ptu.Data.Humidity[0], ptu.Data.Temperature.Ambient[0])*100)/100,
                pressure: ptu.Data.Pressure[0],
                windspeed: wind.Data.Speed.average[0],
                windgust: wind.Data.Speed.limits[1][0],
                winddir: wind.Data.Direction.average[0],
                rainrate: rain.Data.Rain.Intensity[0],
                cloudcover: cloudcover(cloud.Data.Sky, ptu.Data.Temperature.Ambient[0]),
                skytemperature: cloud.Data.Sky,
                skyquality: 0
            };
            res.json(data);
        }
    ).catch(function(err) {
        logger.error('Reading Redis failed', err);
        res.status(500).send('{"error":"Reading redis failed: ' + err + '"}');
    });
});

var server = app.listen(9001, function() {
    var host = server.address().address;
    var port = server.address().port;

    logger.info('koma-weather-server listening at http://%s:%s', host, port);
}).on('error', function(err) {
    logger.error(err);
});
