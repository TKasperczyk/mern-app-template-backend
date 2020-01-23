'use strict';

/**
 * A room manager for Socket.io. Allows to synchronize rooms and their states across multiple workers in the cluster
 * The rooms can be activated and deactivated. This functionality does not change the logic of the room manager - all it does is setting the room's active flag, which can help with controlling the given room outside of the room manager.
 */

const redis = require('redis').createClient;
const {promisify} = require('util');
const logger = require('../logger').appLogger;
const config = require('../config');
const h = require('../helpers');

/** 
 * Redis structure on which this class operates:
 * KEY = namespace name
 * VALUE (hash) = {
 *     roomOne: stringified {
 *         clients: Array of strings (clientIds),
 *         active: boolean
 *     },
 *     roomTwo: stringified {
 *         clients: Array of strings (clientIds),
 *         active: boolean
 *     }
 *     ...
 * }
 * Logical structure of the stored rooms:
 *     namespaceFoo: {
 *         roomBar: {
 *             active: true,
 *             clients: [clientId1, clientId2]
 *         }
 *     },
 *     namespaceBar: {
 *         roomFoo: {
 *             active: true,
 *             clients: [clientId1, clientId3]
 *         },
 *         roomBar: {
 *             active: false,
 *             clients: [clientId3, clientId2]
 *         }
 *     }
 */

class RoomManager {
    /**
     * @description creates a connection with redis. Uses config.db.redis for authentication
     * @param {Number} [dbId] redis database identifier. Make sure you don't reuse them - this class flushes everything in the given database
     */
    constructor(dbId) {
        this._redisAuthOptions = {};
        if (config.db.redis.auth){
            this._redisAuthOptions = {
                auth_pass: config.db.redis.password,
            };
        }
        this._client = redis(config.db.redis.port, config.db.redis.host, this._redisAuthOptions);
        this._redisPromisified = {
            hget: promisify(this._client.hget).bind(this._client),
            hgetall: promisify(this._client.hgetall).bind(this._client),
            hset: promisify(this._client.hset).bind(this._client),
            flushdb: promisify(this._client.flushdb).bind(this._client),
            select: promisify(this._client.select).bind(this._client),
            auth: promisify(this._client.select).bind(this._client)
        };
        this._dbId = dbId;
    }
    /**
     * @description selects a database based on the constructor's dbId argument and flushes it
     * @returns {Boolean} false if something went wrong while interacting with the db
     */
    async init(){
        try{
            await this._redisPromisified.select(this._dbId);
            await this._redisPromisified.flushdb();
            return true;
        } catch (error){
            logger.error(`Failed to initialize the room manager ${error}`, {identifier: 'roomManager', meta: {error}});
            return false;
        }
    }
    /**
     * @description disconnects the redis client - it's a cleanup function
     * @returns {Boolean} the result of redis.client.end
     */
    async destroy(){
        if (this._client.connected){
            return this._client.end(true);
        }
    }
    /**
    * @description gets all the rooms from the given namespace
    * @param {String} [namespace] the namespace that will be searched
    * @returns {Object|null} an object containing all the stored rooms (its keys represent the room names) in the given namespace. Returns null if there are no rooms found
    */
    async getRooms(namespace){
        const rooms = await this._redisPromisified.hgetall(namespace); //Get all rooms in the given namespace
        if (rooms === null){ //If there are no rooms in this namespace, return a null
            return null;
        }
        let result = rooms; //Copy them to a new tmp variable
        for (let roomName in rooms){ //Iterate over the found rooms and parse each of them, then return them
            try{
                result[roomName] = JSON.parse(rooms[roomName]);
            } catch (error){
                logger.error(`A malformed JSON in namespace: ${namespace}`, {identifier: 'roomManager', meta: {roomName, namespace}});
                return null;
            }
        }
        return result;
    }
    /**
    * @description searches for the given room in the given namespace and returns it
    * @param {String} [namespace] the namespace to search in
    * @param {String} [roomName] the room name to search for
    * @returns {Object|null} the room if it exists or null if it doesn't or isn't parsable (they're saved in a stringified version in the db)
    */
    async getRoom(namespace, roomName){
        const room = await this._redisPromisified.hget(namespace, roomName);
        if (room === null){ //If there are no rooms in the given namespace
            return null;
        }
        try{ //Parse the room contents and return it
            return JSON.parse(room);
        } catch (error){
            logger.error(`A malformed JSON in namespace: ${namespace}`, {identifier: 'roomManager', meta: {room, roomName, namespace}});
            return null;
        }
    }
    /**
    * @description checks if the given room in the given namespace doesn't have any clients
    * @param {String} [namespace] the namespace to search
    * @param {String} [roomName] the room name to check
    * @returns {Boolean} true if the room doesn't have any clients inside
    */
    async roomEmpty(namespace, roomName){
        return !(await this.roomExists(namespace, roomName)) || ((await this.getRoom(namespace, roomName)).clients.length === 0);
    }
    /**
     * @description checks if the given room in the given namespace exists
     * @param {String} [namespace] the namespace to search
     * @param {String} [roomName] the room name to check
     * @returns {Boolean} true if the room exists in the given namespace
     */
    async roomExists(namespace, roomName){
        return await this.getRoom(namespace, roomName) !== null;
    }
    /**
    * @description sets the active flag to true on the given room in the given namespace. If the room doesn't exist, creates it before activating
    * @param {String} [namespace] the namespace to search. Don't use numbers even if they're strings
    * @param {String} [roomName] the room to activate. Don't use numbers even if they're strings
    */
    async activateRoom(namespace, roomName){
        if (!(await this.roomExists(namespace, roomName))){
            await this.addRoom(namespace, roomName);
        }
        let room = await this.getRoom(namespace, roomName);
        room.active = true;
        await this._saveRoom(namespace, roomName, room);
    }
    /**
     * @description sets the active flag to true on the given room in the given namespace. If the room doesn't exist, creates it before deactivating
     * @param {String} [namespace] the namespace to search. Don't use numbers even if they're strings
     * @param {String} [roomName] the room to activate. Don't use numbers even if they're strings
     */
    async deactivateRoom(namespace, roomName){
        if (!(await this.roomExists(namespace, roomName))){
            await this.addRoom(namespace, roomName);
        }
        let room = await this.getRoom(namespace, roomName);
        room.active = false;
        await this._saveRoom(namespace, roomName, room);
    }
    /**
    * @description creates a new room with the given name in the given namespace if it doesn't already exist
    * @param {String} [namespace] the namespace in which the room will be created. Don't use numbers even if they're strings
    * @param {String} [roomName] the name of the room to create. Don't use numbers even if they're strings
    * @returns {Boolean} false if the room already existed, true if it was created
    */
    async addRoom(namespace, roomName){
        if (await this.roomExists(namespace, roomName)){
            return false;
        }
        await this._saveRoom(namespace, roomName, {
            clients: new Array,
            active: true
        });
        return true;
    }
    /**
        It downloads the given room from the db, pushes a new clientId to its 'clients' array and saves the room to the db.
        If the given room doesn't exist, it creates it before adding the clientId
    **/
    /**
    * @description adds a new client to the given room in the given namespace. Doesn't check if there are duplicate clientIds. Creates the room if it doesn't exist
    * @param {String} [namespace] the namespace to search. Don't use numbers even if they're strings
    * @param {String} [roomName] the room to which the clientId will be added. Don't use numbers even if they're strings
    * @param {String} [clientId] the client ID to add
    */
    async addClient(namespace, roomName, clientId){
        await this.addRoom(namespace, roomName);
        let room = await this.getRoom(namespace, roomName);
        room.clients.push(clientId);
        await this._saveRoom(namespace, roomName, room);
    }
    /**
    * @description removes the given clientId from the given room in the given namespace. If there are any duplicate clientd IDs, it will remove only one of them
    * @param {String} [namespace] the namespace to search
    * @param {String} [roomName] the room name from which the client ID will be removed
    * @param {String} [clientId] the client ID to remove
    * @returns {Boolean} false if the given room doesn't exist in the given namespace. False if the provided clientId doesn't exist in the room. True if the client ID was removed
    */
    async removeClientFromRoom(namespace, roomName, clientId){
        if (!(await this.roomExists(namespace, roomName))){
            return false;
        }
        let room = await this.getRoom(namespace, roomName);
        const index = room.clients.indexOf(clientId);
        if (index < 0){
            return false;
        }
        room.clients.splice(index, 1);
        await this._saveRoom(namespace, roomName, room);
        return true;
    }
    /**
        Removes the given client from all rooms in the given namespace
    **/
    /**
    * @description removes the given clientId from every room in the given namespace. If there are any duplicate clientd IDs, it will remove only one of them
    * @param {String} [namespace] the namespace to search in
    * @param {String} [clientId] the client ID to remove
    * @returns {Boolean} false if there are no rooms in the provided namespace. True if the client ID was removed from at least one room
    */
    async removeClientFromNamespace(namespace, clientId){
        const allRooms = await this.getRooms(namespace);
        if (allRooms === null || !allRooms){
            return false;
        }
        let anyRemoved = false;
        await h.asyncForEach(allRooms, async (room, roomName) => {
            const removed = await this.removeClientFromRoom(namespace, roomName, clientId);
            if (removed){
                anyRemoved = true;
            }
        });
        return anyRemoved;
    }
    /**
     * @description saves the given room to the database
     * @param {String} [namespace] the namespace in which the room will be saved
     * @param {String} [roomName] the name of the room
     * @param {Object} [roomObj] the room itself
     * @returns {typeof redis.client.hset} the resolved result of redis.client.hset
     */
    async _saveRoom(namespace, roomName, roomObj){
        return await this._redisPromisified.hset(namespace, roomName, JSON.stringify(roomObj));
    }
}

module.exports = RoomManager;
