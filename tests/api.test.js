const testH = require('./helpers');
const api = require('../app/api');
const db = require('../app/db').mongo;

describe('api', () => {
    afterAll(async () => {
        db.mongoose.connection.close();
    });
        
    describe('generics', () => {
        const mockUser = testH.userMocks.basic();
        let userIdMock; //Will be set in the first generics add test
        const generics = api.__private.generics;

        //Remove the mock user before and after running the tests
        beforeAll(async () => {
            await testH.fn.cleanMockUsers(db);
        });
        afterAll(async () => {
            await testH.fn.cleanMockUsers(db);
        });
    
        describe('add', () => {
            it('should add a new object (user)', async () => {
                const result = await generics.add({
                    inputObj: mockUser,
                    modelName: 'data.user',
                });
                expect(result).toHaveProperty('login');
                expect(result.login).toEqual(mockUser.login);
                expect(result.password).toEqual(undefined);
                userIdMock = result._id.toString();
            });
            it('should throw when the model doesn\'t exist', async () => {
                const notExistingModelMock = 'notExistingModel';
                await expect(
                    generics.add({
                        inputObj: testH.userMocks.basic(),
                        modelName: notExistingModelMock
                    })
                ).rejects.toThrow('rong modelName argument');
            });
            it('should throw when the input object is wrong', async () => {
                const wrongInputObjectMock = 'wrongInputObject';
                await expect(
                    generics.add({
                        inputObj: wrongInputObjectMock,
                        modelName: 'data.user'
                    })
                ).rejects.toThrow('rong inputObj argument');
            });
            it('should apply the modifier func when it is defined', async () => {
                const roleMock = 'roleMock';
                const modifierFuncMock = (inputObj) => {
                    inputObj.role = roleMock;
                    return inputObj;
                };
                const result = await generics.add({
                    inputObj: testH.userMocks.alt(),
                    modelName: 'data.user',
                    modifierFunc: modifierFuncMock
                });
                expect(result.role).toEqual(roleMock);
            });
            it('should throw when the input object\'s property is wrong', async () => {
                const wrongUserMock = testH.userMocks.admin();
                wrongUserMock.login = '[]@_';
                await expect(
                    generics.add({
                        inputObj: wrongUserMock,
                        modelName: 'data.user'
                    })
                ).rejects.toHaveProperty('errors');
            });
        });
        describe('get', () => {
            it('should return a new object (user)', async () => {
                const result = await generics.get({
                    id: userIdMock,
                    modelName: 'data.user',
                });
                expect(result).toHaveProperty('login');
                expect(result.login).toEqual(mockUser.login);
                expect(result.password).toEqual(undefined);
            });
            it('should return a list of objects (users) when the id is undefined', async () => {
                const result = await generics.get({
                    modelName: 'data.user',
                });
                expect(result).toHaveProperty('length');
                expect(result.length > 0).toEqual(true);
            });
            it('should return an empty list when nothing is found', async () => {
                const result = await generics.get({
                    id: testH.userMocks.alt()._id,
                    modelName: 'data.user',
                });
                expect(result).toHaveProperty('length');
                expect(result.length).toEqual(0);
            });
        });
        describe('update', () => {
            it('should update an existing object (user)', async () => {
                const userAdminMock = testH.userMocks.admin();
                delete userAdminMock._id;
                const result = await generics.update({
                    id: userIdMock,
                    inputObj: userAdminMock,
                    modelName: 'data.user',
                });
                expect(result).toHaveProperty('login');
                expect(result.login).toEqual(userAdminMock.login);
                expect(result._id.toString()).toEqual(userIdMock);
                expect(result.password).toEqual(undefined);
            });
            it('should throw when _id is being updated', async () => {
                const userAltMock = testH.userMocks.alt();
                await expect(generics.update({
                    id: userIdMock,
                    inputObj: userAltMock,
                    modelName: 'data.user',
                })).rejects.toThrow();
            });
            it('should throw when the id argument is not defined', async () => {
                const userAltMock = testH.userMocks.alt();
                await expect(generics.update({
                    inputObj: userAltMock,
                    modelName: 'data.user',
                })).rejects.toThrow('rong id argument');
            });
            it('should throw when the inputObj argument is wrong', async () => {
                await expect(generics.update({
                    id: userIdMock,
                    inputObj: '',
                    modelName: 'data.user',
                })).rejects.toThrow('rong inputObj argument');
            });
            it('should apply the modifier func when it is defined', async () => {
                const roleMock = 'roleMock';
                const modifierFuncMock = (inputObj) => {
                    inputObj.role = roleMock;
                    return inputObj;
                };
                const userAdminMock = testH.userMocks.admin();
                delete userAdminMock._id;
                const result = await generics.update({
                    id: userIdMock,
                    inputObj: userAdminMock,
                    modelName: 'data.user',
                    modifierFunc: modifierFuncMock
                });
                expect(result.role).toEqual(roleMock);
            });
        });
        describe('delete', () => {
            it('should return the deleted object (user) if it exists', async () => {
                const result = await generics.delete({
                    id: userIdMock,
                    modelName: 'data.user',
                });
                expect(result).toHaveProperty('login');
                expect(result.password).toEqual(undefined);
            });
            it('should throw if the deleted object (user) doesn\'t exist', async () => {
                await expect(generics.delete({
                    id: userIdMock,
                    modelName: 'data.user',
                })).rejects.toThrow('ailed to delete');
            });
            it('should throw if the id argument is undefined', async () => {
                await expect(generics.delete({
                    modelName: 'data.user',
                })).rejects.toThrow('rong id argument');
            });
        });
    });
    describe('user', () => {
        let userIdMock;
    
        //Remove the mock user before and after running the tests
        beforeAll(() => {
            return testH.fn.cleanMockUsers(db);
        });
        afterAll(async () => {
            await testH.fn.cleanMockUsers(db);
            return db.mongoose.connection.close();
        });
    
        it('should allow to add users', async () => {
            let newUser;
            await expect((async () => {
                newUser = await api.user.add({user: testH.userMocks.basic()});
            })()).resolves.not.toThrow();
            expect(newUser).toBeTruthy();
            expect(newUser).toHaveProperty('_id');
            userIdMock = newUser._id.toString();
        });
        it('should allow to update users', async () => {
            let updatedUser;
            await expect((async () => {
                updatedUser = await api.user.update({id: userIdMock, user: {login: testH.userMocks.alt().login}});
            })()).resolves.not.toThrow();
            expect(updatedUser).toHaveProperty('login');
            expect(updatedUser.login).toBe(testH.userMocks.alt().login);
        });
        it('should allow to get users', async () => {
            let retrievedUser;
            await expect((async () => {
                retrievedUser = await api.user.get({id: userIdMock});
            })()).resolves.not.toThrow();
            expect(userIdMock).toBe(retrievedUser._id.toString());
        });
        it('should allow to delete users', async () => {
            let retrievedUser;
            await expect((async () => {
                await api.user.delete({id: userIdMock});
                retrievedUser = await api.user.get({id: userIdMock});
            })()).resolves.not.toThrow();
            expect(retrievedUser).toEqual([]);
        });
    });
});