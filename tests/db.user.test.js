const testH = require('./helpers');
const db = require('../app/db');
const h = require('../app/helpers');

describe('db', () => {
    let newUserModel;
    let retrievedUser;

    beforeAll(() => {
        return testH.fn.cleanMockUsers();
    });
    afterAll(() => {
        //return testH.fn.cleanMockUsers();
    });
    it('should expose the user model', () => {
        //Check if the user model is exposed
        expect(db.mongo).toHaveProperty('models');
        expect(db.mongo.models['data.user']).toBeTruthy();
    });
    it('should connect to the database', async () => {
        //If it's not already connected, give it a total of 2000 timeout
        await h.wait(100);
        if (db.mongo.mongoose.connection.readyState !== 1){
            await h.wait(1900);
        }
        expect(db.mongo.mongoose.connection.readyState).toBe(1);
    });
    it('should allow to create a user', async () => {
        newUserModel = new db.mongo.models['data.user'](testH.userMocks.basic());
        await expect(newUserModel.save()).resolves.not.toThrow();
    });
    it('should not allow to create a user with an existing login (username)', async () => {
        newUserModel = new db.mongo.models['data.user'](testH.userMocks.basic());
        await expect(newUserModel.save()).rejects.toEqual(expect.any(Error));
    });
    it('should not allow to create a user with a wrong username', async () => {
        //Test empty logins
        newUserModel = new db.mongo.models['data.user'](testH.userMocks.basic());
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
            console.log(newUserModel._id.toString());
            retrievedUser = await db.mongo.models['data.user'].find({login: newUserModel.login});
        })()).resolves.not.toThrow();
        expect(retrievedUser).toBeTruthy();
        expect(retrievedUser.password).toBe(undefined);
    });
    it('should allow to delete the created user', async () => {
        await expect((async () => {
            const newUserId = newUserModel._id.toString();
            await newUserModel.delete();
            retrievedUser = await db.mongo.models['data.user'].findById(newUserId);
        })()).resolves.not.toThrow();
        expect(retrievedUser).toBeFalsy();
    });
});