const testH = require('./helpers');
const api = require('../app/api');

describe('api', () => {
    describe('user', () => {
        let mockUserId;
    
        //Remove the mock user before and after running the tests
        beforeAll(() => {
            return testH.fn.cleanMockUsers();
        });
        afterAll(() => {
            return testH.fn.cleanMockUsers();
        });
    
        it('should allow to add users', async () => {
            let newUser;
            await expect((async () => {
                newUser = await api.user.add({user: testH.userMocks.basic()});
            })()).resolves.not.toThrow();
            expect(newUser).toBeTruthy();
            expect(newUser).toHaveProperty('_id');
            mockUserId = newUser._id.toString();
        });
        it('should allow to update users', async () => {
            let updatedUser;
            await expect((async () => {
                updatedUser = await api.user.update({id: mockUserId, user: {login: testH.userMocks.alt().login}});
            })()).resolves.not.toThrow();
            expect(updatedUser).toHaveProperty('login');
            expect(updatedUser.login).toBe(testH.userMocks.alt().login);
        });
        it('should allow to get users', async () => {
            let retrievedUser;
            await expect((async () => {
                retrievedUser = await api.user.get({id: mockUserId});
            })()).resolves.not.toThrow();
            expect(mockUserId).toBe(retrievedUser._id.toString());
        });
        it('should allow to delete users', async () => {
            let retrievedUser;
            await expect((async () => {
                await api.user.delete({id: mockUserId});
                retrievedUser = await api.user.get({id: mockUserId});
            })()).resolves.not.toThrow();
            expect(retrievedUser).toEqual([]);
        });
    });
});