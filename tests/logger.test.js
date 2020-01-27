'use strict';

const logger = require('../app/logger');
const config = require('../app/config');

describe('logger', () => {
    it('should expose the app logger', () => {
        expect(logger).toHaveProperty('appLogger');
        expect(typeof logger.appLogger).toEqual('object');
    });
    it('should expose the http logger', () => {
        expect(logger).toHaveProperty('httpLogger');
        expect(typeof logger.httpLogger).toEqual('object');
    });
    describe('appPrintf', () => {
        const infoMock = {
            identifier: 'identifierMock',
            timestamp: 'timestampMock',
            callId: 'callIdMock',
            message: 'messageMock',
            level: 'api'
        };
        it('should return a Winston printf format', () => {
            const result = logger.__private.appPrintf({colorize: false});
            expect(typeof result.template).toEqual('function');
        });
        it('should include information from the info object in the final message', () => {
            const result = logger.__private.appPrintf({colorize: false});
            const logMessage = result.template(infoMock);
            expect(logMessage).toMatch(new RegExp(`${infoMock.identifier}`));
            expect(logMessage).toMatch(new RegExp(`${infoMock.timestamp}`));
            expect(logMessage).toMatch(new RegExp(`${infoMock.callId}`));
            expect(logMessage).toMatch(new RegExp(`${infoMock.message}`));
            expect(logMessage).toMatch(new RegExp(`${infoMock.level}`));
        });
        it('should include metadata if defined as an object in the final message', () => {
            const result = logger.__private.appPrintf({colorize: false});
            const metaObjectMock = {metaMock: 'metaVal'};
            const logMessage = result.template(Object.assign({}, {meta: metaObjectMock}, infoMock));
            expect(logMessage).toMatch(new RegExp('META'));
            expect(logMessage).toMatch(new RegExp(metaObjectMock.metaMock));
        });
        it('should include metadata if defined as a string in the final message', () => {
            const result = logger.__private.appPrintf({colorize: true});
            const metaStringMock = 'metaString';
            const logMessage = result.template(Object.assign({}, {meta: metaStringMock}, infoMock));
            expect(logMessage).toMatch(new RegExp('META'));
            expect(logMessage).toMatch(new RegExp(metaStringMock));
        });
        it('should ignore jQuery callbacks in the identifier part of the final message', () => {
            const result = logger.__private.appPrintf({colorize: true});
            const logMessage = result.template(Object.assign({}, infoMock, {identifier: 'callback=jQuery'}));
            expect(logMessage).not.toMatch(new RegExp('callback=jQuery'));
        });
        it('should ignore undefined metadata keys', () => {
            const result = logger.__private.appPrintf({colorize: true});
            const metaObjectMock = {metaMock: undefined};
            const logMessage = result.template(Object.assign({}, {meta: metaObjectMock}, infoMock));
            expect(logMessage).not.toMatch(new RegExp('metaMock'));
        });
        it('should extract error messages from the metadata', () => {
            const result = logger.__private.appPrintf({colorize: true});
            const metaObjectMock = {metaMock: new Error('testMessage')};
            const logMessage = result.template(Object.assign({}, {meta: metaObjectMock}, infoMock));
            expect(logMessage).toMatch(new RegExp('testMessage'));
        });
        it('should assign a default identifier when it\'s empty', () => {
            const result = logger.__private.appPrintf({colorize: true});
            const newInfoMock = Object.assign({}, infoMock);
            delete newInfoMock.identifier;
            const logMessage = result.template(newInfoMock);
            expect(logMessage).toMatch(new RegExp('Unknown'));
        });
        it('should trim the metadata if it exceeds the maximum number of chars defined in the config', () => {
            const result = logger.__private.appPrintf({colorize: true});
            let metaStringMock = '';
            let maxMetaLengthMock = 500;
            config.logging.maxMetaLength = maxMetaLengthMock;
            for (let i = 0; i < maxMetaLengthMock; i++){
                metaStringMock += '.';
            }
            metaStringMock += '.';
            const logMessage = result.template(Object.assign({}, {meta: metaStringMock}, infoMock));
            expect(logMessage).toMatch(new RegExp('Too long '));
        });
    });
});