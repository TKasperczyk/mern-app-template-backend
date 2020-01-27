'use strict';

/**
 * Handles all socket.io connections. Authentication of websocket requests is handled in the auth module
 */

const logger = require('../logger').appLogger;

/**
 * Creates a virtual room array. Supports namespaces. Doesn't have anything to do with socket.rooms, but should be used alongside.
 * If you're joining a room in socket.io, you should also join it in the roomManager
 * Room and namespace names CANNOT be numbers even in a String form
 */
const RoomManager = require('../roomManager');

module.exports = (io, app) => {
    const manager = new RoomManager(1); //"1" is the redis database identifier
    manager.init().then(() => {
        io.on('connect_error', (error) => {
            logger.error('An error occured while connecting to a socket', {identifier: 'socket', meta: error});
        });
        io.on('connection', (socket) => {
            logger.debug('A new connection to /', {identifier: 'socket /'});
        });
        //No need to lower our coverage with this example function. Writing tests for something that will be changed/removed after installing mern-app-template-backend is pointless
        /* istanbul ignore next */
        io.of('/test', (socket) => {
            socket.on('testPing', () => {
                socket.emit('testPong', new Date());
            });
        });
    });
};