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

const getServerBundle = (app) => {
    const httpServer = require('http').Server(app);
    const io = require('socket.io')(httpServer);
    //Register all authentication strategies
    require('./auth').registerStrategies(io);
    //We're using only websockets
    io.set('transports', ['websocket']);
    let authOptions = {};
    if (config.db.redis.auth){
        authOptions = {
            auth_pass: config.db.redis.password,
        };
    }
    const pubClient = redis(config.db.redis.port, config.db.redis.host, authOptions);
    const subClient = redis(config.db.redis.port, config.db.redis.host, authOptions);
    io.adapter(adapter({
        pubClient,
        subClient
    }));
    require('./socket')(io, app);
    return {
        httpServer,
        ioServer: io,
        __private: {
            redis: {
                authOptions,
                pubClient,
                subClient
            }
        }
    };
};

module.exports = {
    router: require('./router'),
    logger: require('./logger'),
    helpers: require('./helpers'),
    config,
    getServerBundle,
};
