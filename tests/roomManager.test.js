const redis = require('redis').createClient;
const {promisify} = require('util');
const config = require('../app/config');
const RoomManager = require('../app/roomManager');

const redisClient = redis(config.db.redis.port, config.db.redis.host, {
    auth_pass: config.db.redis.password,
});
const rClientPromisified = {
    hget: promisify(redisClient.hget).bind(redisClient),
    hgetall: promisify(redisClient.hgetall).bind(redisClient),
    hset: promisify(redisClient.hset).bind(redisClient),
    flushdb: promisify(redisClient.flushdb).bind(redisClient),
    select: promisify(redisClient.select).bind(redisClient),
    auth: promisify(redisClient.select).bind(redisClient)
};
const dbIndex = 1;

const mockNamespace = 'testNamespace';
const mockRoom1 = 'testRoom1';
const mockRoom2 = 'testRoom2';

describe('roomManager', () => {
    const rm = new RoomManager(dbIndex);
    let spySelect, spyFlushdb;
    beforeAll(async () => {
        spySelect = jest.spyOn(rm._redisPromisified, 'select');
        spyFlushdb = jest.spyOn(rm._redisPromisified, 'flushdb');
        await rClientPromisified.select(dbIndex);
        return rm.init();
    });
    describe('init', () => {
        it('should connect to Redis', () => {
            expect(rm._client.connected).toBe(true);
        });
        it('should select a database', () => {
            expect(spySelect).toHaveBeenCalled();
        });
        it('should flush the database', () => {
            expect(spyFlushdb).toHaveBeenCalled();
        });
    });
    it('getRooms should return null when there are none', async () => {
        expect(await rm.getRooms(mockNamespace)).toEqual(null);
    });
    it('getRoom should return null when there are none', async () => {
        expect(await rm.getRoom(mockNamespace, mockRoom1)).toEqual(null);
    });
    it('roomEmpty should return true when there are no rooms', async () => {
        expect(await rm.roomEmpty(mockNamespace, mockRoom1)).toEqual(true);
    });
    it('roomExists should return false when there are no rooms', async () => {
        expect(await rm.roomExists(mockNamespace, mockRoom1)).toEqual(false);
    });
    it('addRoom should create a new room in the db', async () => {
        expect(await rm.addRoom(mockNamespace, mockRoom1)).toEqual(true);
        const room = await rClientPromisified.hget(mockNamespace, mockRoom1);
        expect(room).toBeTruthy();
        expect(() => {
            JSON.parse(room);
        }).not.toThrow();
    });
    it('getRoom should return the created room which should be active by default', async () => {
        const room = await rm.getRoom(mockNamespace, mockRoom1);
        expect(room).toBeTruthy();
        expect(room).toHaveProperty('clients');
        expect(room.active).toBe(true);
    });
    it('getRooms should return the created room', async () => {
        const rooms = await rm.getRooms(mockNamespace);
        expect(rooms).toBeTruthy();
        expect(rooms).toHaveProperty(mockRoom1);
    });
    it('roomEmpty should return false when there are no clients in a room', async () => {
        expect(await rm.roomEmpty(mockNamespace, mockRoom1)).toEqual(true);
    });
    it('roomExists should return true when the room exists', async () => {
        expect(await rm.roomExists(mockNamespace, mockRoom1)).toEqual(true);
    });
    it('roomExists should return false when the room doesn\'t exist', async () => {
        expect(await rm.roomExists(mockNamespace, mockRoom2)).toEqual(false);
    });
    it('deactivateRoom should set the active flag to false', async () => {
       await rm.deactivateRoom(mockNamespace, mockRoom1);
       const room = await rm.getRoom(mockNamespace, mockRoom1);
       expect(room).toBeTruthy();
       expect(room.active).toBe(false);
    });
    it('activateRoom should set the active flag to true', async () => {
        await rm.activateRoom(mockNamespace, mockRoom1);
        const room = await rm.getRoom(mockNamespace, mockRoom1);
        expect(room).toBeTruthy();
        expect(room.active).toBe(true);
    });
    it('addClient should add a client to the given room', async () => {
        await rm.addClient(mockNamespace, mockRoom1, 'testClientId');
        const room = await rm.getRoom(mockNamespace, mockRoom1);
        expect(room).toBeTruthy();
        expect(room.clients.length).toBe(1);
        expect(room.clients[0]).toBe('testClientId');
     });
     it('removeClientFromRoom should delete a client from the given room', async () => {
        await rm.removeClientFromRoom(mockNamespace, mockRoom1, 'testClientId');
        const room = await rm.getRoom(mockNamespace, mockRoom1);
        expect(room).toBeTruthy();
        expect(room.clients.length).toBe(0);
     });
     it('removeClientFromNamespace should delete a client from the given namespace', async () => {
        await rm.addRoom(mockNamespace, mockRoom2);
        await rm.addClient(mockNamespace, mockRoom1, 'testClientId');
        await rm.addClient(mockNamespace, mockRoom2, 'testClientId');
        let room1 = await rm.getRoom(mockNamespace, mockRoom1);
        let room2 = await rm.getRoom(mockNamespace, mockRoom2);
        expect(room1).toBeTruthy();
        expect(room2).toBeTruthy();
        expect(room1.clients.length).toBe(1);
        expect(room2.clients.length).toBe(1);

        await rm.removeClientFromNamespace(mockNamespace, 'testClientId');
        room1 = await rm.getRoom(mockNamespace, mockRoom1);
        room2 = await rm.getRoom(mockNamespace, mockRoom2);
        expect(room1).toBeTruthy();
        expect(room2).toBeTruthy();
        expect(room1.clients.length).toBe(0);
        expect(room2.clients.length).toBe(0);
     });
     it('removeClientFromNamespace should not delete other clients from the given namespace', async () => {
        await rm.addClient(mockNamespace, mockRoom1, 'testClientId-1');
        await rm.addClient(mockNamespace, mockRoom2, 'testClientId');

        await rm.removeClientFromNamespace(mockNamespace, 'testClientId-1');
        let room1 = await rm.getRoom(mockNamespace, mockRoom1);
        let room2 = await rm.getRoom(mockNamespace, mockRoom2);
        expect(room1.clients.length).toBe(0);
        expect(room2.clients.length).toBe(1);
     });
     it('getRooms should return all of the created rooms', async () => {
        const rooms = await rm.getRooms(mockNamespace);
        expect(rooms).toBeTruthy();
        expect(rooms).toHaveProperty(mockRoom1);
        expect(rooms).toHaveProperty(mockRoom2);
    });
});