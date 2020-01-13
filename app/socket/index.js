'use strict';

/**
    Global messages that are sent to the users
**/

const logger = require('../logger').appLogger;

/**
    Creates a virtual room array. Supports namespaces. Doesn't have anything to do with socket.rooms, but should be used alongside with it.
    If you're joining a room in socket.io, you should also join it in the roomManager
    Room and namespace names CANNOT be numbers even in a String form
**/
const RoomManager = require('../roomManager');

module.exports = (io, app) => {
    const manager = new RoomManager(1); //"1" is the redis database identifier
    manager.init().then(() => {
        io.on('connect_error', (error) => {
            logger.error('An error occured while connecting to a socket', {identifier: 'socket', meta: error});
        });
        io.of('/test').on('connection', (socket) => {
            logger.debug('A new connection to /test', {identifier: 'socket /test'});
            socket.on('testPing', () => {
                logger.debug('Got ping, sending pong', {identifier: 'socket /test'});
                socket.emit('testPong', new Date());
            });
        });
    });
};
