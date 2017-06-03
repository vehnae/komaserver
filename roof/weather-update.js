var http = require('http');
var memcache = require('memcache');

var MEMCACHE_HOST = 'localhost'
var MEMCACHE_PORT = 11211

var url = 'http://taika.fi/~jsaukkon/weather.js';
// var url = 'http://api.openweathermap.org/data/2.5/weather?lat=60.17&lon=24.39&appid=59ebf83d55f9651695997e735804157f&units=metric';

http.get(url, (res) => {
    var body = '';
    res.on('data', (chunk) => {
        body += chunk;
    });
    res.on('end', () => {
        var client = new memcache.Client(MEMCACHE_PORT, MEMCACHE_HOST);
        client.on('connect', () => {
            client.set('openweathermap', JSON.stringify(JSON.parse(body)), () => {
                client.close();
            });
        });
        client.connect();
    });
    res.resume();
}).on('error', (e) => {
    console.log(`Got error: ${e.message}`);
});
