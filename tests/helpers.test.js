const jwt = require('jsonwebtoken');
const bCrypt = require('bcrypt-nodejs');
const testH = require('./helpers');
const h = require('../app/helpers');
const config = require('../app/config');

describe('helpers', () => {
    it('isMasterWorker should identify the master worker', () => {
        process.env.id = '1';
        expect(h.isMasterWorker()).toBeTruthy();
        process.env.id = '2';
        expect(h.isMasterWorker()).toBeFalsy();
    });
    it('generateResponse should return a correct object response', () => {
        let response = h.generateResponse({
            status: false, 
            data: 'data', 
            error: 'error'
        });
        expect(response).toBeTruthy();
        expect(response.status).toBe(false);
        expect(response.data).toBe('data');
        expect(response.error).toBe('error');
        response = h.generateResponse();
        expect(response).toBeTruthy();
        //Check the default values as well
        expect(response.status).toBe(null);
        expect(response.data).toBe(null);
        expect(response.error).toBe(null);
    });
    it('generateJwt should return a proper JWT token', () => {
        const userMock = testH.userMocks.basic();
        const token = h.generateJwt({from: userMock});
        expect(jwt.verify(token, config.jwtKey)).toBeTruthy();
    });
    it('generateCallId should generate a random set of numbers', () => {
        const callId1 = String(h.generateCallId());
        expect(callId1).toEqual(expect.stringMatching(/[1-9]{1,}/));
        const callId2 = h.generateCallId();
        expect(callId1).not.toEqual(callId2);
    });
    it('generateHash should generate a correct bCrypt hash', () => {
        const userMock = testH.userMocks.basic();
        const hash = h.generateHash({password: userMock.password, rounds: 5});
        expect(hash).toEqual(expect.stringMatching(/[a-zA-Z1-9]{1,}/));
        expect(bCrypt.compareSync(userMock.password, hash)).toBeTruthy();
    });
    it('wait should return a promise that resolves after some time', () => {
        return expect(h.wait(50)).resolves.not.toThrow();
    });
});
describe('helpers isValidPassword', () => {
    const userMock = testH.userMocks.basic();
    const hash = h.generateHash({password: userMock.password, rounds: 5});
    const cleartextPassword = userMock.password;
    userMock.password = hash;

    it('should return false if the password is wrong', () => {
        config.openAuth = false;
        expect(h.isValidPassword({hashedPassword: userMock.password, cleartextPassword: 'wrongPassword'})).toBe(false);
    });
    it('should return true the password is correct', () => {
        config.openAuth = false;
        expect(h.isValidPassword({hashedPassword: userMock.password, cleartextPassword})).toBe(true);
    });
});
describe('helpers optionalStringify', () => {
    const objMock = {
        prop: 'val'
    };
    const objMockStr = JSON.stringify(objMock, null, 4);
    it('should return a stringified object', () => {
        expect(h.optionalStringify(objMock)).toEqual(objMockStr);
    });
    it('should return the original argument if it\'s not an object', () => {
        expect(h.optionalStringify(objMockStr)).toBe(objMockStr);
    });
    it('should return the original argument if it\'s an empty object', () => {
        expect(h.optionalStringify({})).toEqual({});
    });
});
describe('helpers optionalParse', () => {
    const objMock = {
        prop: 'val'
    };
    const objMockStr = JSON.stringify(objMock);
    it('should return a parsed object', () => {
        expect(h.optionalParse(objMockStr)).toEqual(objMock);
    });
    it('should return the original argument if it\'s not parsable', () => {
        expect(h.optionalParse(objMock)).toBe(objMock);
        expect(h.optionalParse(1)).toEqual(1);
    });
});
describe('helpers checkMandatoryArgs', () => {
    it('should return true if the arguments are correct', () => {
        const valueMapMock = {
            mandatoryProp: 'foo',
            optionalProp: 'bar'
        };
        const argMapMock = {mandatoryProp: true};
        expect(h.checkMandatoryArgs({argMap: argMapMock, args: valueMapMock})).toBe(true);
    });
    it('should ignore the value in argMap', () => {
        const valueMapMock = {mandatoryProp: 'foo'};
        const argMapMock = {mandatoryProp: true};
        //The value in the map shouldn't matter as long as it's not undefined
        argMapMock.mandatoryProp = false;
        expect(h.checkMandatoryArgs({argMap: argMapMock, args: valueMapMock})).toBe(true);
    });
    it('should return false if an argument is missing', () => {
        const valueMapMock = {optionalProp: 'foo'};
        const argMapMock = {mandatoryProp: true};
        expect(h.checkMandatoryArgs({argMap: argMapMock, args: valueMapMock})).toBe(false);
        valueMapMock.mandatoryProp = 'foo';
        argMapMock.mandatoryProp = (value) => {
            return value === 'foo';
        };
        expect(h.checkMandatoryArgs({argMap: argMapMock, args: valueMapMock})).toBe(true);
    });
    it('should take into account checker functions', () => {
        const valueMapMock = {mandatoryProp: 'foo'};
        let argMapMock = {mandatoryProp: (value) => {
            return value !== 'foo';
        }};
        expect(h.checkMandatoryArgs({argMap: argMapMock, args: valueMapMock})).toBe(false);
        argMapMock = {mandatoryProp: (value) => {
            return value === 'foo';
        }};
        expect(h.checkMandatoryArgs({argMap: argMapMock, args: valueMapMock})).toBe(true);
        delete valueMapMock.mandatoryProp;
        expect(h.checkMandatoryArgs({argMap: argMapMock, args: valueMapMock})).toBe(false);

    });
});