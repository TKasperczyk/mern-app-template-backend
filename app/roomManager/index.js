'use strict';

/**
    A room manager for Socket.io. Allows to synchronize rooms and their states across multiple workers in the cluster
    The rooms can be activated and deactivated. This functionality does not change the logic of the room manager - all it does is setting the room's active flag, which can help with controlling the given room outside of the room manager.
**/

const redis = require('redis').createClient;
const {promisify} = require('util');
const logger = require('../logger').appLogger;
const config = require('../config');
const h = require('../helpers');

/** 
    Redis structure on which this class operates:
    KEY = namespace name
    VALUE (hash) = {
        roomOne: stringified {
            clients: Array,
            active: boolean
        },
        roomTwo: stringified {
            clients: Array,
            active: boolean
        }
        ...
    }
    Logical structure of the stored rooms:
        namespaceOne: {
            roomOne: {
                active: true,
                clients: [client1, client2]
            }
        },
        namespaceTwo: {
            roomOne: {
                active: true,
                clients: [client3, client4]
            },
            roomTwo: {
                active: false,
                clients: [client5, client6]
            }
        }
**/

class RoomManager {
    //Make sure you don't override an existing Redis database - use a number that's not already used by your Redis instance
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
        Selects a database based on the constructor's dbId argument and flushes it
    **/
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
    async destroy(){
        if (this._client.connected){
            return this._client.end(true);
        }
    }
    /**
        Returns an object containing all the stored rooms (its keys represent room names) in the given namespace
        Returns null if there are no rooms
    **/
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
        Returns a single room
    **/
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
        Returns false if the given room doesn't exist or doesn't contain any clients
    **/
    async roomEmpty(namespace, roomName){
        return !(await this.roomExists(namespace, roomName)) || ((await this.getRoom(namespace, roomName)).clients.length === 0);
    }
    async roomExists(namespace, roomName){
        return await this.getRoom(namespace, roomName) !== null;
    }
    /**
        If the given room doesn't exist, the function creates it. If the room does exist, it sets the active property to true and saves it to the db
    **/
    async activateRoom(namespace, roomName){
        if (!(await this.roomExists(namespace, roomName))){
            await this.addRoom(namespace, roomName);
        }
        let room = await this.getRoom(namespace, roomName);
        room.active = true;
        await this._saveRoom(namespace, roomName, room);
    }
    async deactivateRoom(namespace, roomName){
        if (!(await this.roomExists(namespace, roomName))){
            await this.addRoom(namespace, roomName);
        }
        let room = await this.getRoom(namespace, roomName);
        room.active = false;
        await this._saveRoom(namespace, roomName, room);
    }
    /**
        Returns false if the given room already exists
    **/
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
    async addClient(namespace, roomName, clientId){
        await this.addRoom(namespace, roomName);
        let room = await this.getRoom(namespace, roomName);
        room.clients.push(clientId);
        await this._saveRoom(namespace, roomName, room);
    }
    /**
        Returns false if the given room doesn't exist. Works similarly to addClient function
    **/
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
    async removeClientFromNamespace(namespace, clientId){
        const allRooms = await this.getRooms(namespace);
        if (allRooms === null || !allRooms){
            return false;
        }
        await h.asyncForEach(allRooms, async (room, roomName) => {
            await this.removeClientFromRoom(namespace, roomName, clientId);
        });
        return true;
    }
    async _saveRoom(namespace, roomName, roomObj){
        return await this._redisPromisified.hset(namespace, roomName, JSON.stringify(roomObj));
    }
}

module.exports = RoomManager;
