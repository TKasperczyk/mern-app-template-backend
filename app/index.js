'use strict';

/**
    Sets up an http server that supports socket.io. 
**/

const redis = require('redis').createClient;
const adapter = require('socket.io-redis');
const config = require('./config');
const h = require('./helpers');

//Run only one scheduler 
if (h.isMasterWorker()){
    require('./scheduler')();
}

const ioServer = (app) => {
    const server = require('http').Server(app);
    const io = require('socket.io')(server);
    //Register all authentication strategies
    require('./auth')(io);
    //We're using only websockets
    io.set('transports', ['websocket']);
    const pubClient = redis(config.db.redis.port, config.db.redis.host, {
        auth_pass: config.db.redis.password
    });
    const subClient = redis(config.db.redis.port, config.db.redis.host, {
        auth_pass: config.db.redis.password
    });
    io.adapter(adapter({
        pubClient,
        subClient
    }));
    require('./socket')(io, app);
    return server;
};

module.exports = {
    router: require('./router')(),
    logger: require('./logger'),
    helpers: require('./helpers'),
    config,
    ioServer,
};
