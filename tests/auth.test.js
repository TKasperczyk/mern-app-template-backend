'use strict';

const jwt = require('jsonwebtoken');
const testH = require('./helpers');
const h = require('../app/helpers');
const auth = require('../app/auth');
const db = require('../app/db').mongo;
const api = require('../app/api');

const reqMock = {
    connection: {
        remoteAddress: '1.2.3.4'
    }
};
const userMock = testH.userMocks.basic();
const userMock2 = testH.userMocks.alt();

describe('auth', () => {
    const signUpProcessor = auth.__private.signUpProcessor;
    const signInProcessor = auth.__private.signInProcessor;
    const jwtAuthProcessor = auth.__private.jwtAuthProcessor;
    
    beforeAll(() => {
        auth.registerStrategies();
    });
    beforeEach(() => {
        return testH.fn.cleanUserMocks(db);
    });
    afterAll(async () => {
        await testH.fn.cleanUserMocks(db);
        db.mongoose.connection.close();
    });
    
    describe('signUpProcessor', () => {
        it('should allow new users to sign up without exposing their password in the result', (done) => {
            signUpProcessor(reqMock, userMock.username, userMock.password, (error, user) => {
                expect(error).toBe(null);
                expect(user).toHaveProperty('username');
                expect(user).not.toHaveProperty('password');
                expect(user.username).toBe(userMock.username);
                done();
            });
        });
        it('should not allow new users to sign up with an existing username', async (done) => {
            await api.controllers['data.user'].add({inputObj: userMock});
            signUpProcessor(reqMock, userMock.username, userMock.password, (error, user) => {
                expect(error).toBe('Username already taken');
                expect(user).toBeFalsy();
                done();
            });
        });
        it('should not allow new users to sign up with a wrong username', (done) => {
            const wrongUsernamenMock = '@_[]';
            signUpProcessor(reqMock, wrongUsernamenMock, userMock.password, (error, user) => {
                expect(error).toBe('Unknown authentication error');
                expect(user).toBeFalsy();
                done();
            });
        });
        it('should deny users when there is a database problem', (done) => {
            const backupModel = db.models['data.user'];
            db.models['data.user'] = null;
            signUpProcessor(reqMock, userMock.username, userMock.password, (error, user) => {
                expect(error).toBe('Unknown authentication error');
                expect(user).toBeFalsy();
                db.models['data.user'] = backupModel;
                done();
            });
        });
    });
    describe('signInProcessor', () => {
        it('should authenticate users with correct credentials without exposing their password in the result', async (done) => {
            //Our mock has a cleartext password, we need to hash it
            const modifiedUserMock = Object.assign({}, userMock, {password: h.generateHash({password: userMock.password})});
            await api.controllers['data.user'].add({inputObj: modifiedUserMock});
            signInProcessor(reqMock, userMock.username, userMock.password, (error, user) => {
                expect(error).toBe(null);
                expect(user).toHaveProperty('username');
                expect(user).not.toHaveProperty('password');
                expect(user.username).toBe(userMock.username);
                done();
            });
        });
        it('should deny users with wrong username', (done) => {
            const wrongUsernameMock = 'wrongUsername';
            signInProcessor(reqMock, wrongUsernameMock, userMock.password, (error, user) => {
                expect(error).toBe('Authentication error');
                expect(user).toBeFalsy();
                done();
            });
        });
        it('should deny users when there is a database problem', (done) => {
            const backupModel = db.models['data.user'];
            db.models['data.user'] = null;
            signInProcessor(reqMock, userMock.username, userMock.password, (error, user) => {
                expect(error).toBe('Unknown authentication error');
                expect(user).toBeFalsy();
                db.models['data.user'] = backupModel;
                done();
            });
        });
        it('should deny users with wrong password', async (done) => {
            //Our mock has a cleartext password, we need to hash it
            const modifiedUserMock = Object.assign({}, userMock, {password: h.generateHash({password: userMock.password})});
            await api.controllers['data.user'].add({inputObj: modifiedUserMock});
            const wrongPasswordMock = 'wrongPassword';
            signInProcessor(reqMock, userMock.username, wrongPasswordMock, (error, user) => {
                expect(error).toBe('Authentication error');
                expect(user).toBeFalsy();
                done();
            });
        });
        it('should deny users with empty credentials', (done) => {
            const emptyPasswordMock = '';
            const emptyUsernameMock = '';
            signInProcessor(reqMock, emptyUsernameMock, emptyPasswordMock, (error, user) => {
                expect(error).toBe('Authentication error');
                expect(user).toBeFalsy();
                done();
            });
        });
    });
    describe('jwtAuthProcessor', () => {
        it('should authenticate users with a correct JWT payload', async (done) => {
            //Our mock has a cleartext password, we need to hash it
            const modifiedUserMock = Object.assign({}, userMock, {password: h.generateHash({password: userMock.password})});
            await api.controllers['data.user'].add({inputObj: modifiedUserMock});
            jwtAuthProcessor(reqMock, modifiedUserMock, (error, user) => {
                expect(error).toBe(null);
                expect(user).toHaveProperty('username');
                expect(user.username).toBe(userMock.username);
                done();
            });
        });
        it('should deny users with a JWT payload containing a wrong user id', (done) => {
            jwtAuthProcessor(reqMock, userMock, (error, user) => {
                expect(error).toBe('Authentication error');
                expect(user).toBeFalsy();
                done();
            });
        });
        it('should deny users when there is a database problem', (done) => {
            const backupModel = db.models['data.user'];
            db.models['data.user'] = null;
            jwtAuthProcessor(reqMock, userMock, (error, user) => {
                expect(error).toBe('Unknown authentication error');
                expect(user).toBeFalsy();
                db.models['data.user'] = backupModel;
                done();
            });
        });
    });
});