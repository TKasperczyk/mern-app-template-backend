const rewire = require('rewire');
const jwt = require('jsonwebtoken');
const testH = require('./helpers');
const h = require('../app/helpers');
const auth = rewire('../app/auth');

const reqMock = {
    connection: {
        remoteAddress: '1.2.3.4'
    }
};
const userMock = testH.userMocks.basic();

describe('auth', () => {
    let jwtPayload; //Will be set in the localAuthProcessor test. Will hold a user object
    
    beforeAll(() => {
        return testH.fn.cleanMockUsers();
    });
    afterAll(() => {
        return testH.fn.cleanMockUsers();
    });
    describe('registerProcessor', () => {
        it('should allow new users to register without exposing their password in the result', (done) => {
            auth.__get__('registerProcessor')(reqMock, userMock.login, userMock.password, (error, user) => {
                expect(error).toBe(null);
                expect(user).toHaveProperty('login');
                expect(user).not.toHaveProperty('password');
                expect(user.login).toBe(userMock.login);
                done();
            });
        });
        it('should not allow new users to register with an existing login (username)', (done) => {
            auth.__get__('registerProcessor')(reqMock, userMock.login, userMock.password, (error, user) => {
                expect(error).toBe('Username already taken');
                expect(user).toBeFalsy();
                done();
            });
        });
        it('should not allow new users to register with a wrong login (username)', (done) => {
            const wrongLoginMock = '@_[]';
            auth.__get__('registerProcessor')(reqMock, wrongLoginMock, userMock.password, (error, user) => {
                expect(error).toBe('Unknown authentication error');
                expect(user).toBeFalsy();
                done();
            });
        });
    });
    describe('localAuthProcessor', () => {
        it('should authenticate users with correct credentials without exposing their password in the result', (done) => {
            auth.__get__('localAuthProcessor')(reqMock, userMock.login, userMock.password, (error, user) => {
                expect(error).toBe(null);
                expect(user).toHaveProperty('login');
                expect(user).not.toHaveProperty('password');
                expect(user.login).toBe(userMock.login);
                const jwToken = h.generateJwt(user);
                jwtPayload = jwt.decode(jwToken);
                done();
            });
        });
        it('should deny users with wrong login (username)', (done) => {
            const wrongLoginMock = 'wrongLogin';
            auth.__get__('localAuthProcessor')(reqMock, wrongLoginMock, userMock.password, (error, user) => {
                expect(error).toBe('Authentication error');
                expect(user).toBeFalsy();
                done();
            });
        });
        it('should deny users with wrong password', (done) => {
            const wrongPasswordMock = 'wrongPassword';
            auth.__get__('localAuthProcessor')(reqMock, userMock.login, wrongPasswordMock, (error, user) => {
                expect(error).toBe('Authentication error');
                expect(user).toBeFalsy();
                done();
            });
        });
        it('should deny users with empty credentials', (done) => {
            const emptyPasswordMock = '';
            const emptyLoginMock = '';
            auth.__get__('localAuthProcessor')(reqMock, emptyLoginMock, emptyPasswordMock, (error, user) => {
                expect(error).toBe('Authentication error');
                expect(user).toBeFalsy();
                done();
            });
        });
    });
    describe('jwtAuthProcessor', () => {
        it('should authenticate users with a correct JWT payload', (done) => {
            auth.__get__('jwtAuthProcessor')(reqMock, jwtPayload, (error, user) => {
                expect(error).toBe(null);
                expect(user).toHaveProperty('login');
                expect(user.login).toBe(userMock.login);
                done();
            });
        });
        it('should deny users with a JWT payload containing a wrong user id', (done) => {
            const wrongIdMock = userMock._id;
            jwtPayload._id = wrongIdMock;
            auth.__get__('jwtAuthProcessor')(reqMock, jwtPayload, (error, user) => {
                expect(error).toBe('Authentication error');
                expect(user).toBeFalsy();
                done();
            });
        });
    });
});