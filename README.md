# Komakallio roof server

You need to have a memcached running in port 11211 for storing runtime data:

```
git clone git://github.com/dalssoft/memcached.js.git
cd memcached.js
npm install
bin/memcachedjs --port 11211
```

To run the server, run:

```
npm install
node server.js
```

## Examples

```curl http://localhost:9000/weather```

```curl http://localhost:9000/safe```

```curl -X POST http://localhost:9000/roof/jari/open```

```curl http://localhost:9000/roof/jari```

```curl -X POST http://localhost:9000/roof/jari/close```
