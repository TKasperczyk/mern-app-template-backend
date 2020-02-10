'use strict';

const supertest = require('supertest');
const jwt = require('jsonwebtoken');
const testH = require('./helpers');
const db = require('../app/db').mongo;
const h = require('../app/helpers');
const server = require('../server.js');

describe('router', () => {
    let runningServer;
    let app;
    const mockUser1 = testH.userMocks.basic();
    const mockUser2 = testH.userMocks.alt();
    const mockUserAdmin = testH.userMocks.admin();

    beforeEach(async () => {
        await testH.fn.cleanUserMocks(db);
    });
    beforeAll(async (done) => {
        //Run the io server
        const workerId = 1;
        runningServer = server(workerId, () => {
            app = runningServer.app;
            done();
        });
    });
    afterAll(async () => {
        await testH.fn.cleanUserMocks(db);
        //Close the connections
        runningServer.bundle.ioServer.close();
        db.mongoose.connection.close();
    });
    
    describe('/api/signup', () => {
        it('should allow users to sign up', async () => {
            let res = await supertest(app)
                .post('/api/signup')
                .send({username: mockUser1.username, password: mockUser1.password})
                .expect(200);
            expect(res.body).toHaveProperty('data');
        });
        it('should return a proper JWT', async () => {
            let res = await supertest(app)
                .post('/api/signup')
                .send({username: mockUser1.username, password: mockUser1.password})
                .expect(200);
            const mockUser1Token = res.body.data;
            expect(typeof mockUser1Token).toEqual('string');
            expect(mockUser1Token.length > 0).toBeTruthy();
            const mockUser1Payload = jwt.decode(mockUser1Token);
            expect(mockUser1Payload).toHaveProperty('username');
            expect(mockUser1Payload.username).toEqual(mockUser1.username);
            expect(mockUser1Payload).not.toHaveProperty('password');
        });
        it('should not allow for signing up with an existing username', async () => {
            let res = await supertest(app)
                .post('/api/signup')
                .send({username: mockUser1.username, password: mockUser1.password})
                .expect(200);
            res = await supertest(app)
                .post('/api/signup')
                .send({username: mockUser1.username, password: mockUser1.password})
                .expect(500);
            expect(res.body).toHaveProperty('error');
            expect(res.body.error).toEqual('Username already taken');
        });
        it('should not allow for signing up with an empty username or password', async () => {
            let res = await supertest(app)
                .post('/api/signup')
                .send({username: '', password: mockUser1.password})
                .expect(500);
            expect(res.body).toHaveProperty('status');
            expect(res.body.status).toEqual(false);

            res = await supertest(app)
                .post('/api/signup')
                .send({username: mockUser1.username, password: ''})
                .expect(500);
            expect(res.body).toHaveProperty('status');
            expect(res.body.status).toEqual(false);

            res = await supertest(app)
                .post('/api/signup')
                .send({username: mockUser1.username})
                .expect(500);
            expect(res.body).toHaveProperty('status');
            expect(res.body.status).toEqual(false);
        });
    });

    describe('/api/signin', () => {
        it('should not allow to sign in with wrong credentials', async () => {
            let res = await supertest(app)
                .post('/api/signin')
                .send({username: mockUser1.username, password: mockUser1.password})
                .expect(401);
            expect(res.body).toHaveProperty('status');
            expect(res.body.status).toEqual(false);
            expect(res.body.error).toEqual('Unauthorized');
        });
        it('should not allow to sign in with empty credentials', async () => {
            let res = await supertest(app)
                .post('/api/signin')
                .send({username: '', password: mockUser1.password})
                .expect(401);
            expect(res.body).toHaveProperty('status');
            expect(res.body.status).toEqual(false);

            res = await supertest(app)
                .post('/api/signin')
                .send({username: mockUser2.username, password: ''})
                .expect(401);
            expect(res.body).toHaveProperty('status');
            expect(res.body.status).toEqual(false);

            res = await supertest(app)
                .post('/api/signin')
                .send({username: mockUser2.username})
                .expect(401);
            expect(res.body).toHaveProperty('status');
            expect(res.body.status).toEqual(false);
        });
        it('should allow to sign in with proper credentials and return a correct JWT token', async () => {
            let res = await supertest(app)
                .post('/api/signup')
                .send({username: mockUserAdmin.username, password: mockUserAdmin.password})
                .expect(200);

            res = await supertest(app)
                .post('/api/signin')
                .send({username: mockUserAdmin.username, password: mockUserAdmin.password})
                .expect(200);
            expect(res.body).toHaveProperty('data');
            expect(res.body.status).toEqual(true);
            const signInToken = res.body.data;
            expect(typeof signInToken).toEqual('string');
            expect(signInToken.length > 0).toBeTruthy();
            const signInPayload = jwt.decode(signInToken);
            expect(signInPayload).toHaveProperty('username');
            expect(signInPayload.username).toEqual(mockUserAdmin.username);
            expect(signInPayload).not.toHaveProperty('password');
        });
    });

    describe('/api/user', () => {
        let mockUser1Payload, mockUser1Token, mockUserAdminToken;
        beforeEach(async () => {
            await testH.fn.cleanUserMocks(db);

            let res = await supertest(app)
                .post('/api/signup')
                .send({username: mockUserAdmin.username, password: mockUserAdmin.password})
                .expect(200);
            mockUserAdminToken = res.body.data;
            await db.models['data.user'].updateOne({username: mockUserAdmin.username}, {$set: {role: 'admin'}});

            res = await supertest(app)
                .post('/api/signup')
                .send({username: mockUser1.username, password: mockUser1.password})
                .expect(200);
            mockUser1Token = res.body.data;
            mockUser1Payload = jwt.decode(mockUser1Token);
        });
        it('should not allow to access any method without a valid token', async () => {
            await supertest(app)
                .get('/api/user')
                .expect(401);
            await supertest(app)
                .get(`/api/user/${mockUser1Payload._id}`)
                .expect(401);
            await supertest(app)
                .put(`/api/user/${mockUser1Payload._id}`)
                .send({username: 'test'})
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
            expect(res.body.data).toHaveProperty('username');
            expect(res.body.data.username).toEqual(mockUser1.username);
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
                .send({data: {username: mockUser2.username}})
                .expect(200);
            expect(res.body.status).toEqual(true);
            expect(res.body.data).toHaveProperty('username');
            expect(res.body.data.username).toEqual(mockUser2.username);
            expect(res.body.data).not.toHaveProperty('password');
            //Restore the original username
            await supertest(app)
                .patch(`/api/user/${mockUser1Payload._id}`)
                .set('Authorization', `Bearer ${mockUser1Token}`)
                .send({data: {username: mockUser1.username}})
                .expect(200);
        });
        it('should hash the password when PATCHing the current user with a valid token', async () => {
            const res = await supertest(app)
                .patch(`/api/user/${mockUser1Payload._id}`)
                .set('Authorization', `Bearer ${mockUser1Token}`)
                .send({data: {username: mockUser1.username, password: mockUser1.password}})
                .expect(200);
            expect(res.body.status).toEqual(true);
            expect(res.body.data).toHaveProperty('username');
            expect(res.body.data.username).toEqual(mockUser1.username);
            expect(res.body.data).not.toHaveProperty('password');
            //Restore the original username
            const user = await db.models['data.user'].findOne({username: mockUser1.username}).select('+password').lean();
            expect(user).toHaveProperty('password');
            expect(user.password.length > 0).toBeTruthy();
            expect(h.isValidPassword({hashedPassword: user.password, cleartextPassword: mockUser1.password})).toBe(true);
        });
        it('should not allow to PATCH all the users with a valid token', async () => {
            const res = await supertest(app)
                .patch(`/api/user`)
                .set('Authorization', `Bearer ${mockUser1Token}`)
                .send({data: {username: mockUser2.username}})
                .expect(401);
            expect(res.body.status).toEqual(false);
            expect(res.body.error).toEqual('Access violation error');
        });
        it('should not allow to PATCH the current user\'r role with a valid token', async () => {
            const res = await supertest(app)
                .patch(`/api/user/${mockUser1Payload._id}`)
                .set('Authorization', `Bearer ${mockUser1Token}`)
                .send({data: {role: 'admin', username: mockUser1.username}})
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
                .send({data: {username: 'admin'}})
                .expect(401);
            expect(res.body.status).toEqual(false);
            expect(res.body.error).toEqual('Something went wrong while performing an API call: You don\'t have sufficient permissions to perform this action');
        });
        it('should allow to PATCH another user with a valid token (admin)', async () => {
            const res = await supertest(app)
                .patch(`/api/user/${mockUser1Payload._id}`)
                .set('Authorization', `Bearer ${mockUserAdminToken}`)
                .send({data: {username: mockUser1.username}})
                .expect(200);
            expect(res.body.status).toEqual(true);
            expect(res.body.error).toBeFalsy();
            expect(res.body.data).toHaveProperty('username');
            expect(res.body.data.username).toEqual(mockUser1.username);
        });
        it('should not allow to PATCH a user with a valid token (admin) and missing mandatory arguments', async () => {
            const res = await supertest(app)
                .patch(`/api/user/${mockUser1Payload._id}`)
                .set('Authorization', `Bearer ${mockUserAdminToken}`)
                .expect(400);
            expect(res.body.status).toEqual(false);
            expect(res.body.error).toBe('Something went wrong while performing an API call: Incorrect or incomplete arguments');
        });
        it('should not allow to DELETE all the users with a valid token', async () => {
            const res = await supertest(app)
                .delete(`/api/user`)
                .set('Authorization', `Bearer ${mockUser1Token}`)
                .send({data: {username: mockUser2.username}})
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
    it('should return 404 for non-existing routes', async () => {
        const nonExistingRouteMock = '/nonExistingRoute';
        let res = await supertest(app)
            .post('/api/signup')
            .send({username: mockUser1.username, password: mockUser1.password})
            .expect(200);
        const mockUser1Token = res.body.data;
        await supertest(app)
            .get(nonExistingRouteMock)
            .set('Authorization', `Bearer ${mockUser1Token}`)
            .expect(404);
    });
});