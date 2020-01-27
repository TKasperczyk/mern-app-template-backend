'use strict';

const path = require('path');
const testH = require('./helpers');
const db = require('../app/db').mongo;
const h = require('../app/helpers');
const config = require('../app/config');

describe('db', () => {
    let newUserModel;
    let retrievedUser;

    beforeAll(async () => {
        await testH.fn.cleanMockUsers(db);
    });
    afterAll(async () => {
        await testH.fn.cleanMockUsers(db);
        db.mongoose.connection.close();
    });
    
    it('should expose the user model', () => {
        //Check if the user model is exposed
        expect(db).toHaveProperty('models');
        expect(db.models['data.user']).toBeTruthy();
    });
    it('should connect to the database', async () => {
        //If it's not already connected, give it a total of 2000 timeout
        await h.wait(100);
        if (db.mongoose.connection.readyState !== 1){
            await h.wait(1900);
        }
        expect(db.mongoose.connection.readyState).toBe(1);
    });
    it('should set proper auth options if config.db.mongo.auth is true', async () => {
        let tempDb = require('../app/db').mongo;
        let authOptions = tempDb.__private.generateAuthOptions();
        expect(authOptions).toEqual({});
        const configJsonMock = JSON.parse(testH.fileMocks.config.basic());
        configJsonMock.db.mongo.auth = true;
        testH.fn.upsertFsMockFiles({
            [path.resolve(__dirname, '../config/config.json')]: JSON.stringify(configJsonMock)
        });
        config._reload();
        expect(config.db.mongo.auth).toEqual(true);
        tempDb = require('../app/db').mongo;
        authOptions = tempDb.__private.generateAuthOptions();
        expect(authOptions).toHaveProperty('user');
        expect(authOptions).toHaveProperty('pass');
        expect(authOptions.user).toEqual(config.db.mongo.user);
        expect(authOptions.pass).toEqual(config.db.mongo.password);
        configJsonMock.db.mongo.auth = true;
        testH.fn.upsertFsMockFiles({
            [path.resolve(__dirname, '../config/config.json')]: JSON.stringify(configJsonMock)
        });
        config._reload();
    });
    it('should allow to create a user', async () => {
        newUserModel = new db.models['data.user'](testH.userMocks.basic());
        await expect(newUserModel.save()).resolves.not.toThrow();
    });
    it('should not allow to create a user with an existing login (username)', async () => {
        newUserModel = new db.models['data.user'](testH.userMocks.basic());
        await expect(newUserModel.save()).rejects.toEqual(expect.any(Error));
    });
    it('should not allow to create a user with a wrong username', async () => {
        //Test empty logins
        newUserModel = new db.models['data.user'](testH.userMocks.basic());
        newUserModel.login = '';
        await expect(newUserModel.save()).rejects.toEqual(expect.any(Error));
        //Test special char logins
        newUserModel.login = 'someChars@#';
        await expect(newUserModel.save()).rejects.toEqual(expect.any(Error));
    });
    it('should set the default role for the created user', () => {
        expect(newUserModel.role).toBe('user');
    });
    it('should hide the password when retrieving the created user', async () => {
        await expect((async () => {
            retrievedUser = await db.models['data.user'].find({login: newUserModel.login});
        })()).resolves.not.toThrow();
        expect(retrievedUser).toBeTruthy();
        expect(retrievedUser.password).toBe(undefined);
    });
    it('should allow to delete the created user', async () => {
        await expect((async () => {
            const newUserId = newUserModel._id.toString();
            await newUserModel.delete();
            retrievedUser = await db.models['data.user'].findById(newUserId);
        })()).resolves.not.toThrow();
        expect(retrievedUser).toBeFalsy();
    });
});