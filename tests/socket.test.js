'use strict';

const io = require('socket.io-client');
const testH = require('./helpers');
const server = require('../server');
const db = require('../app/db').mongo;
const h = require('../app/helpers');
const config = require('../app/config');

const ioOptions = {
    transports: ['websocket'],
    'reconnect': true,
    'reconnection delay': 0,
    'reopen delay': 0,
    'force new connection': true,
};

describe('socket', () => {
    let socket = {};
    let token;
    let runningServer;
    const url = `http://${config.server.rootDomain}:${config.server.port}/`;

    beforeAll(async (done) => {
        jest.setTimeout(10000);

        await testH.fn.cleanMockUsers(db);
        //Add the admin user to the database because we need an auth token to perform the tests
        const mockUserAdmin = testH.userMocks.admin();
        delete mockUserAdmin._id;
        mockUserAdmin.password = h.generateHash({password: mockUserAdmin.password});
        const newAdmin = new db.models['data.user'](mockUserAdmin);
        await newAdmin.save();
        token = h.generateJwt({from: newAdmin.toObject()});
        //Run the io server
        const workerId = 1;
        runningServer = server(workerId, () => {
            done();
        });
    });
    afterAll(async () => {
        await testH.fn.cleanMockUsers(db);
        //Close the connections
        runningServer.bundle.ioServer.close();
        db.mongoose.connection.close();
        if (socket.connected){
            socket.disconnect();
        }
    });

    it('should accept new socket.io connections with a correct auth token', (done) => {
        jest.setTimeout(10000);
        socket = io(url, {...ioOptions, query: {
            token
        }});
        socket.on('connect', () => {
            done();
        });
    });
    it('should not accept new socket.io connections with a missing auth token', (done) => {
        socket = io(url, ioOptions);
        socket.on('disconnect', (reason) => {
            expect(reason).toEqual('transport close');
            done();
        });
    });
    it('should not accept new socket.io connections with a malformed auth token', (done) => {
        socket = io(url, {...ioOptions, query: {
            token: token + '1'
        }});
        socket.on('error', (error) => {
            expect(error).toBe('JsonWebTokenError: invalid signature');
            done();
        });
    });
    
});