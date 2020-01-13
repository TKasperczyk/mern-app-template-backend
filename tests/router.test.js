const supertest = require('supertest');
const jwt = require('jsonwebtoken');
const workerId = 1;
const testH = require('./helpers');
const db = require('../app/db').mongo.models;
const h = require('../app/helpers');
const app = require('../server.js')(workerId);

describe('router', () => {
    //Will be filled in the /api/signup and /api/login tests
    let mockUser1Token = null;
    let mockUser1Payload = null;
    let mockUserAdminToken = null;
    let mockUserAdminPayload = null;
    const mockUser1 = testH.userMocks.basic();
    const mockUser2 = testH.userMocks.alt();
    const mockUserAdmin = testH.userMocks.admin();

    //Remove mock users before and after running the tests
    beforeAll(async () => {
        await testH.fn.cleanMockUsers();
        //Add the admin user to the database
        const mockUserAdminDb = testH.userMocks.admin();
        delete mockUserAdminDb._id;
        mockUserAdminDb.password = h.generateHash(mockUserAdminDb.password);
        const newAdmin = new db['data.user'](mockUserAdminDb);
        await newAdmin.save();
    });
    afterAll(() => {
        //return testH.fn.cleanMockUsers();
    });
    
    describe('/api/signup', () => {
        it('should allow for user registration', async () => {
            let res = await supertest(app)
                .post('/api/signup')
                .send({login: mockUser1.login, password: mockUser1.password})
                .expect(200)
            expect(res.body).toHaveProperty('data');
            mockUser1Token = res.body.data;
        });
        it('should return a proper JWT', () => {
            expect(typeof mockUser1Token).toEqual('string');
            expect(mockUser1Token.length > 0).toBeTruthy();
            mockUser1Payload = jwt.decode(mockUser1Token);
            expect(mockUser1Payload).toHaveProperty('login');
            expect(mockUser1Payload.login).toEqual(mockUser1.login);
            expect(mockUser1Payload).not.toHaveProperty('password');
        });
        it('should not allow for registering with an existing login (username)', async () => {
            const res = await supertest(app)
                .post('/api/signup')
                .send({login: mockUser1.login, password: mockUser1.password})
                .expect(500);
            expect(res.body).toHaveProperty('error');
            expect(res.body.error).toEqual('Username already taken');
        });
        it('should not allow for registering with an empty login (username) or password', async () => {
            let res = await supertest(app)
                .post('/api/signup')
                .send({login: '', password: mockUser1.password})
                .expect(500);
            expect(res.body).toHaveProperty('status');
            expect(res.body.status).toEqual(false);

            res = await supertest(app)
                .post('/api/signup')
                .send({login: mockUser2.login, password: ''})
                .expect(500);
            expect(res.body).toHaveProperty('status');
            expect(res.body.status).toEqual(false);

            res = await supertest(app)
                .post('/api/signup')
                .send({login: mockUser2.login})
                .expect(500);
            expect(res.body).toHaveProperty('status');
            expect(res.body.status).toEqual(false);
        });
    });

    describe('/api/login', () => {
        it('should not allow to login with wrong credentials', async () => {
            let res = await supertest(app)
                .post('/api/login')
                .send({login: mockUser2.login, password: mockUser2.password})
                .expect(401);
            expect(res.body).toHaveProperty('status');
            expect(res.body.status).toEqual(false);
            expect(res.body.error).toEqual('Unauthorized');
        });
        it('should not allow to login with empty credentials', async () => {
            let res = await supertest(app)
                .post('/api/login')
                .send({login: '', password: mockUser1.password})
                .expect(401);
            expect(res.body).toHaveProperty('status');
            expect(res.body.status).toEqual(false);

            res = await supertest(app)
                .post('/api/login')
                .send({login: mockUser2.login, password: ''})
                .expect(401);
            expect(res.body).toHaveProperty('status');
            expect(res.body.status).toEqual(false);

            res = await supertest(app)
                .post('/api/login')
                .send({login: mockUser2.login})
                .expect(401);
            expect(res.body).toHaveProperty('status');
            expect(res.body.status).toEqual(false);
        });
        it('should allow to login with proper credentials and return a correct JWT token', async () => {
            //User
            let res = await supertest(app)
                .post('/api/login')
                .send({login: mockUser1.login, password: mockUser1.password})
                .expect(200);
            expect(res.body).toHaveProperty('data');
            expect(res.body.status).toEqual(true);

            const loginToken = res.body.data;
            expect(typeof loginToken).toEqual('string');
            expect(loginToken.length > 0).toBeTruthy();
            const loginPayload = jwt.decode(loginToken);
            expect(loginPayload).toHaveProperty('login');
            expect(loginPayload.login).toEqual(mockUser1.login);
            expect(loginPayload).not.toHaveProperty('password');

            //Admin
            res = await supertest(app)
                .post('/api/login')
                .send({login: mockUserAdmin.login, password: mockUserAdmin.password})
                .expect(200);
            expect(res.body).toHaveProperty('data');
            expect(res.body.status).toEqual(true);
            mockUserAdminToken = res.body.data;
            mockUserAdminPayload = jwt.decode(mockUserAdminToken);
        });
    });

    describe('/api/user', () => {
        it('should not allow to access any method without a valid token', async () => {
            await supertest(app)
                .get('/api/user')
                .expect(401);
            await supertest(app)
                .get(`/api/user/${mockUser1Payload._id}`)
                .expect(401);
            await supertest(app)
                .put(`/api/user/${mockUser1Payload._id}`)
                .send({login: 'test'})
                .expect(401);
            await supertest(app)
                .delete(`/api/user/${mockUser1Payload._id}`)
                .expect(401);
        });
        it('should allow to GET the current user with a valid token', async () => {
            const res = await supertest(app)
                .get(`/api/user/${mockUser1Payload._id}`)
                .set('Authorization', `Bearer ${mockUser1Token}`)
                .expect(200);
            expect(res.body.status).toEqual(true);
            expect(res.body.data).toHaveProperty('login');
            expect(res.body.data.login).toEqual(mockUser1.login);
            expect(res.body.data).not.toHaveProperty('password');
        });
        it('should not allow to GET all users with a valid token (non-admin)', async () => {
            const res = await supertest(app)
                .get('/api/user')
                .set('Authorization', `Bearer ${mockUser1Token}`)
                .expect(401);
            expect(res.body.status).toEqual(false);
            expect(res.body.error).toEqual('Access violation error');
        });
        it('should allow to GET all users with a valid token (admin)', async () => {
            const res = await supertest(app)
                .get('/api/user')
                .set('Authorization', `Bearer ${mockUserAdminToken}`)
                .expect(200);
            expect(res.body.status).toEqual(true);
            expect(res.body.error).toBeFalsy();
            expect(res.body.data.length > 0).toBeTruthy();
        });
        it('should not allow to GET another user with a valid token (non-admin)', async () => {
            const res = await supertest(app)
                .get(`/api/user/${mockUser1._id}`)
                .set('Authorization', `Bearer ${mockUser1Token}`)
                .expect(401);
            expect(res.body.status).toEqual(false);
        });
        it('should allow to PATCH the current user with a valid token', async () => {
            const res = await supertest(app)
                .patch(`/api/user/${mockUser1Payload._id}`)
                .set('Authorization', `Bearer ${mockUser1Token}`)
                .send({data: {login: mockUser2.login}})
                .expect(200);
            expect(res.body.status).toEqual(true);
            expect(res.body.data).toHaveProperty('login');
            expect(res.body.data.login).toEqual(mockUser2.login);
            expect(res.body.data).not.toHaveProperty('password');
            //Restore the original login
            await supertest(app)
                .patch(`/api/user/${mockUser1Payload._id}`)
                .set('Authorization', `Bearer ${mockUser1Token}`)
                .send({data: {login: mockUser1.login}})
                .expect(200);
        });
        it('should not allow to PATCH all the users with a valid token', async () => {
            const res = await supertest(app)
                .patch(`/api/user`)
                .set('Authorization', `Bearer ${mockUser1Token}`)
                .send({data: {login: mockUser2.login}})
                .expect(401);
            expect(res.body.status).toEqual(false);
            expect(res.body.error).toEqual('Access violation error');
        });
        it('should not allow to PATCH the current user\'r role with a valid token', async () => {
            const res = await supertest(app)
                .patch(`/api/user/${mockUser1Payload._id}`)
                .set('Authorization', `Bearer ${mockUser1Token}`)
                .send({data: {role: 'admin', login: mockUser1.login}})
                .expect(200);
            expect(res.body.status).toEqual(true);
            expect(res.body.data).toHaveProperty('role');
            expect(res.body.data.role).toEqual('user');
            await supertest(app)
                .patch(`/api/user/${mockUser1Payload._id}`)
                .set('Authorization', `Bearer ${mockUser1Token}`)
                .send({data: {role: 'admin'}})
                .expect(500);
        });
        it('should not allow to PATCH another user with a valid token (non-admin)', async () => {
            const res = await supertest(app)
                .patch(`/api/user/${mockUser1._id}`)
                .set('Authorization', `Bearer ${mockUser1Token}`)
                .send({data: {login: 'admin'}})
                .expect(401);
            expect(res.body.status).toEqual(false);
            expect(res.body.error).toEqual('Something went wrong while performing an API call: You don\'t have sufficient permissions to perform this action');
        });
        it('should allow to PATCH another user with a valid token (admin)', async () => {
            const res = await supertest(app)
                .patch(`/api/user/${mockUser1Payload._id}`)
                .set('Authorization', `Bearer ${mockUserAdminToken}`)
                .send({data: {login: mockUser1.login}})
                .expect(200);
            expect(res.body.status).toEqual(true);
            expect(res.body.error).toBeFalsy();
            expect(res.body.data).toHaveProperty('login');
            expect(res.body.data.login).toEqual(mockUser1.login);
        });
        it('should not allow to DELETE all the users with a valid token', async () => {
            const res = await supertest(app)
                .delete(`/api/user`)
                .set('Authorization', `Bearer ${mockUser1Token}`)
                .send({data: {login: mockUser2.login}})
                .expect(401);
            expect(res.body.status).toEqual(false);
            expect(res.body.error).toEqual('Access violation error');
        });
        it('should not allow to DELETE another user with a valid token (non-admin)', async () => {
            const res = await supertest(app)
                .delete(`/api/user/${mockUser1._id}`)
                .set('Authorization', `Bearer ${mockUser1Token}`)
                .expect(401);
            expect(res.body.status).toEqual(false);
            expect(res.body.error).toEqual('Something went wrong while performing an API call: You don\'t have sufficient permissions to perform this action');
        });
        it('should allow to DELETE another user with a valid token (admin)', async () => {
            const res = await supertest(app)
                .delete(`/api/user/${mockUser1Payload._id}`)
                .set('Authorization', `Bearer ${mockUserAdminToken}`)
                .expect(200);
            expect(res.body.status).toEqual(true);
            expect(res.body.error).toBeFalsy();
        });
    });
});