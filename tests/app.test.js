const testH = require('./helpers');
const db = require('../app/db').mongo;

//This will be used to closed all the connections created by multiple calls to app.getServerBundle
const redisConnections = [];

describe('app', () => {
    beforeEach(() => {
        testH.fn.resetAll({setupConfig: true});
    });
    afterAll(async () => {
        redisConnections.forEach((connection) => {
            connection.end(true);
        });
        db.mongoose.connection.close();
    });

    it('should run the scheduler if it is the master worker', () => {
        const h = require('../app/helpers');
        let isMasterWorkerSpy = jest.spyOn(h, 'isMasterWorker').mockImplementation(() => {
            return true;
        });
        jest.mock('../app/scheduler'); 
        const schedulerMock = require('../app/scheduler');
        require('../app');
        expect(isMasterWorkerSpy).toHaveBeenCalled();
        expect(schedulerMock).toHaveBeenCalled();
        isMasterWorkerSpy.mockRestore();
        schedulerMock.mockRestore();
    });
    it('should not run scheduler if it is the master worker', () => {
        const h = require('../app/helpers');
        let isMasterWorkerSpy = jest.spyOn(h, 'isMasterWorker').mockImplementation(() => {
            return false;
        });
        jest.mock('../app/scheduler'); 
        const schedulerMock = require('../app/scheduler');
        require('../app');
        expect(isMasterWorkerSpy).toHaveBeenCalled();
        expect(schedulerMock).not.toHaveBeenCalled();
        isMasterWorkerSpy.mockRestore();
        schedulerMock.mockRestore();
    });
    it('should expose the router', () => {
        const app = require('../app');
        expect(app).toHaveProperty('router');
        expect(app.router).toHaveProperty('instance');
    });
    it('getServerBundle should call the auth module', () => {
        const auth= require('../app/auth');
        const authSpy = jest.spyOn(auth, 'registerStrategies');
        const serverBundle = require('../app').getServerBundle();
        redisConnections.push(serverBundle.__private.redis.pubClient, serverBundle.__private.redis.subClient);
        expect(authSpy).toHaveBeenCalled();
    });
    it('should not add auth options to redis IO clients if not defined in the config', () => {
        const serverBundle = require('../app').getServerBundle();
        redisConnections.push(serverBundle.__private.redis.pubClient, serverBundle.__private.redis.subClient);
        expect(serverBundle.__private.redis.authOptions).toEqual({});
    });
    it('should add auth options to redis IO clients if defined in the config', () => {
        const configJson = JSON.parse(testH.fileMocks.config.basic());
        configJson.db.redis.auth = true;
        testH.fn.setFsMockConfig({configString: JSON.stringify(configJson)});
        const config = require('../app/config');
        config._reload();
        const serverBundle = require('../app').getServerBundle();
        redisConnections.push(serverBundle.__private.redis.pubClient, serverBundle.__private.redis.subClient);
        expect(serverBundle.__private.redis.authOptions).toHaveProperty('auth_pass');
        expect(serverBundle.__private.redis.authOptions.auth_pass).toEqual(config.db.redis.password);
    });
});