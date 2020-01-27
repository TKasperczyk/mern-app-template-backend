'use strict';

/**
 * Sets up an http server that supports socket.io. 
 */

const redis = require('redis').createClient;
const adapter = require('socket.io-redis');
const config = require('./config');
const h = require('./helpers');

//Run only one scheduler
if (h.isMasterWorker()) {
    require('./scheduler')();
}

/**
 * @description creates a "server bundle" that contains the http and io server. In most cases we only need ioServer because it already controls httpServer as described here: https://github.com/socketio/socket.io#how-to-use
 * @param {Object} [app] an instance of require('express')()
 * @returns {Object} the described server bundle
 */
const getServerBundle = (app) => {
    //Create the http server that will be controlled by socket.io
    const httpServer = require('http').Server(app);
    //Create the io server
    const io = require('socket.io')(httpServer);
    //Register all authentication strategies and secure all io connections
    require('./auth').registerStrategies(io);
    //We're using only websockets because it's "better" (https://socket.io/docs/client-api#With-websocket-transport-only)
    io.set('transports', ['websocket']);
    let authOptions = {};
    //Avoid Redis auth warnings by not appending the auth options if there is no auth
    if (config.db.redis.auth) {
        authOptions = {
            auth_pass: config.db.redis.password,
        };
    }
    //The pub-sub mechanism for socket.io adapter (https://github.com/socketio/socket.io-redis). Allows for sending and receiving events across multiple io instances (we're multithreading)
    const pubClient = redis(config.db.redis.port, config.db.redis.host, authOptions);
    const subClient = redis(config.db.redis.port, config.db.redis.host, authOptions);
    io.adapter(adapter({
        pubClient,
        subClient
    }));
    //Socket is up and ready, we can setup our socket logic
    require('./socket')(io, app);
    return {
        httpServer,
        ioServer: io,
        __private: { //For tests
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