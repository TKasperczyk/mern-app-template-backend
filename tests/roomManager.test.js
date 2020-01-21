const redis = require('redis').createClient;
const {promisify} = require('util');
const config = require('../app/config');
const RoomManager = require('../app/roomManager');

let authOptions = {};
if (config.db.redis.auth){
    authOptions = {
        auth_pass: config.db.redis.password,
    };
}
const redisClient = redis(config.db.redis.port, config.db.redis.host, authOptions);
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
const mockRoom3 = 'testRoom3';

describe('roomManager', () => {
    const rm = new RoomManager(dbIndex);
    let spySelect, spyFlushdb;
    
    beforeAll(async () => {
        spySelect = jest.spyOn(rm._redisPromisified, 'select');
        spyFlushdb = jest.spyOn(rm._redisPromisified, 'flushdb');
        await rClientPromisified.select(dbIndex);
        return rm.init();
    });
    afterAll(async () => {
        if (redis.connected){
            redis.end(true);
        }
        await rm.destroy();
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('constructor should add auth options to redis client when it\'s defined in the config', async () => {
        config.db.redis.auth = true;
        const authRm = new RoomManager(dbIndex);
        expect(authRm._redisAuthOptions).toHaveProperty('auth_pass');
        expect(authRm._redisAuthOptions.auth_pass).toEqual(config.db.redis.password);
        await authRm.destroy();
    });
    it('constructor should not add auth options to redis client when it\'s not defined in the config', async () => {
        config.db.redis.auth = false;
        const noAuthRm = new RoomManager(dbIndex);
        expect(noAuthRm._redisAuthOptions).not.toHaveProperty('auth_pass');
        await noAuthRm.destroy();
    });
    describe('init (called in beforeAll)', () => {
        it('should connect to Redis', () => {
            expect(rm._client.connected).toBe(true);
        });
        it('should select a database', () => {
            expect(spySelect).toHaveBeenCalled();
        });
        it('should flush the database', () => {
            expect(spyFlushdb).toHaveBeenCalled();
        });
        it('should return false if the db index is too high', async () => {
            const wrongDbIdMock = 1234567;
            const wrongDbIdRm = new RoomManager(wrongDbIdMock);
            const result = await wrongDbIdRm.init();
            expect(result).toBe(false);
            await wrongDbIdRm.destroy();
        });
    });
    it('getRooms should return null when there are none', async () => {
        expect(await rm.getRooms(mockNamespace)).toEqual(null);
    });
    it('getRooms should return null when a room is malformed', async () => {
        const testNamespaceMock = 'testNamespace';
        const testRoomNameMock = 'testRoomName';
        const wrongJsonMock = '{}}}!';
        await rClientPromisified.hset(testNamespaceMock, testRoomNameMock, wrongJsonMock);
        expect(await rm.getRooms(testNamespaceMock)).toEqual(null);
        await rClientPromisified.flushdb();
    });
    it('getRoom should return null when there are none', async () => {
        expect(await rm.getRoom(mockNamespace, mockRoom1)).toEqual(null);
    });
    it('getRoom should return null when a room is malformed', async () => {
        const testNamespaceMock = 'testNamespace';
        const testRoomNameMock = 'testRoomName';
        const wrongJsonMock = '{}}}!';
        await rClientPromisified.hset(testNamespaceMock, testRoomNameMock, wrongJsonMock);
        expect(await rm.getRoom(testNamespaceMock, testRoomNameMock)).toEqual(null);
        await rClientPromisified.flushdb();
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
    it('deactivateRoom create a new room when it doesn\'t exist', async () => {
        await rm.deactivateRoom(mockNamespace, mockRoom3);
        const room3 = await rm.getRoom(mockNamespace, mockRoom3);
        expect(room3).toBeTruthy();
        expect(room3.active).toBe(false);
    });
    it('activateRoom should set the active flag to true', async () => {
        await rm.activateRoom(mockNamespace, mockRoom1);
        const room = await rm.getRoom(mockNamespace, mockRoom1);
        expect(room).toBeTruthy();
        expect(room.active).toBe(true);
    });
    it('activateRoom should create a new room when it doesn\'t exist', async () => {
        await rm.activateRoom(mockNamespace, mockRoom2);
        const room2 = await rm.getRoom(mockNamespace, mockRoom2);
        expect(room2).toBeTruthy();
        expect(room2.active).toBe(true);
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
    it('removeClientFromRoom should return false if the room doesn\'t exist', async () => {
        const notExistingRoomMock = 'notExistingRoomMock';
        const result = await rm.removeClientFromRoom(mockNamespace, notExistingRoomMock, 'testClientId');
        expect(result).toBe(false);
    });
    it('removeClientFromNamespace should delete a client from the given namespace', async () => {
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
    it('removeClientFromNamespace should return false if the given namespace doesn\'t exist', async () => {
        const notExistingNamespaceMock = 'notExistingNamespace';
        const result = await rm.removeClientFromNamespace(notExistingNamespaceMock, 'testClientId');
        expect(result).toBe(false);
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
    it('destroy should call the redis client\'s quit function', () => {
        const rmClientEndSpy = jest.spyOn(rm._client, 'end');
        rm.destroy();
        expect(rmClientEndSpy).toHaveBeenCalled();
    });
});