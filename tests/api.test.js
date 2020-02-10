'use strict';

const testH = require('./helpers');
const api = require('../app/api');
const db = require('../app/db').mongo;

const generics = api.__private.generics;

/**
 * @description a helper function that allows for adding objects to the database by using either the [API data.user add controller] or the [API generic add function]
 * @param {Object} [inputObj] object containing the model's data 
 * @param {String} [modelName] the model name of the added document
 * @param {String} [mode = 'controllers'] either 'controllers' or 'generics'
 */
const addObjectToDb = (inputObj, modelName, mode = 'controllers') => {
    if(mode === 'controllers'){
        return api.controllers[modelName].add({
            inputObj
        });
    } else if (mode === 'generics'){
        return generics.add({
            inputObj,
            modelName,
        });
    }
};

describe('api', () => {
    afterAll(async () => {
        db.mongoose.connection.close();
    });

    describe('generics', () => {
        //These will be overwritten before each test because we need to make sure that they are registered in mongoose
        let schemaMock, schemaMockModelName;
        const modelObjectMock = testH.mongooseMocks.modelObjects.basic();

        beforeEach(async () => {
            schemaMock = testH.mongooseMocks.schema.basic(db);
            schemaMockModelName = schemaMock.modelName;
            await testH.fn.cleanModelMocks(db);
        });
        afterAll(async () => {
            await testH.fn.dropModelMocks(db);
        });

        describe('add', () => {
            it('should add a new object and hide non-selectable properties', async () => {
                const result = await addObjectToDb(modelObjectMock, schemaMockModelName, 'generics');
                expect(result).toHaveProperty('withRestrictions');
                expect(result.withRestrictions).toEqual(modelObjectMock.withRestrictions);
                expect(result.nonSelectable).toEqual(undefined);
            });
            it('should throw when the model does not exist', async () => {
                const notExistingModelMock = 'notExistingModel';
                await expect(
                    generics.add({
                        inputObj: modelObjectMock,
                        modelName: notExistingModelMock
                    })
                ).rejects.toThrow('rong modelName argument');
            });
            it('should throw when the input object is wrong', async () => {
                const wrongInputObjectMock = 'wrongInputObject';
                await expect(
                    generics.add({
                        inputObj: wrongInputObjectMock,
                        modelName: schemaMockModelName
                    })
                ).rejects.toThrow('rong inputObj argument');
            });
            it('should apply the modifier func when it is defined', async () => {
                const simpleStringMock = '_assimpleStrin123g';
                const modifierFuncSpy = jest.fn((inputObj) => {
                    inputObj.simpleString = simpleStringMock;
                    return inputObj;
                });
                const result = await generics.add({
                    inputObj: modelObjectMock,
                    modelName: schemaMockModelName,
                    modifierFunc: modifierFuncSpy
                });
                expect(modifierFuncSpy).toHaveBeenCalled();
                expect(result.simpleString).toEqual(simpleStringMock);
            });
            it('should throw when the input object\'s property is wrong', async () => {
                const wrongUserMock = testH.userMocks.admin();
                wrongUserMock.username = '[]@_';
                await expect(
                    generics.add({
                        inputObj: wrongUserMock,
                        modelName: 'data.user'
                    })
                ).rejects.toHaveProperty('errors');
            });
        });
        describe('get', () => {
            it('should return a new object and hide non-selectable properties', async () => {
                let result = await addObjectToDb(modelObjectMock, schemaMockModelName, 'generics');
                const modelObjectMockId = result._id.toString();
                result = await generics.get({
                    id: modelObjectMockId,
                    modelName: schemaMockModelName,
                });
                expect(result).toHaveProperty('withRestrictions');
                expect(result.withRestrictions).toEqual(modelObjectMock.withRestrictions);
                expect(result.nonSelectable).toEqual(undefined);
            });
            it('should return a list of objects (users) when the id is undefined', async () => {
                let result = await addObjectToDb(modelObjectMock, schemaMockModelName, 'generics');
                result = await generics.get({
                    modelName: schemaMockModelName,
                });
                expect(result).toHaveProperty('length');
                expect(result.length).toEqual(1);
            });
            it('should return an empty list when nothing is found', async () => {
                const result = await generics.get({
                    id: testH.userMocks.alt()._id, //Examplary, non-existing ID
                    modelName: schemaMockModelName,
                });
                expect(result).toHaveProperty('length');
                expect(result.length).toEqual(0);
            });
        });
        describe('update', () => {
            it('should update an existing object (user) and hide non-selectable properties', async () => {
                let result = await addObjectToDb(modelObjectMock, schemaMockModelName, 'generics');
                const modelObjectMockId = result._id.toString();
                const altModelObjectMock = testH.mongooseMocks.modelObjects.alt();
                delete altModelObjectMock._id;
                result = await generics.update({
                    id: modelObjectMockId,
                    inputObj: altModelObjectMock,
                    modelName: schemaMockModelName,
                });
                expect(result).toHaveProperty('withRestrictions');
                expect(result.withRestrictions).toEqual(altModelObjectMock.withRestrictions);
                expect(result._id.toString()).toEqual(modelObjectMockId);
                expect(result.nonSelectable).toEqual(undefined);
            });
            it('should throw when _id is being updated', async () => {
                let result = await addObjectToDb(modelObjectMock, schemaMockModelName, 'generics');
                const modelObjectMockId = result._id.toString();
                const altModelObjectMock = testH.mongooseMocks.modelObjects.alt();
                await expect(generics.update({
                    id: modelObjectMockId,
                    inputObj: altModelObjectMock,
                    modelName: schemaMockModelName,
                })).rejects.toThrow();
            });
            it('should throw when the id argument is not defined', async () => {
                await expect(generics.update({
                    inputObj: modelObjectMock,
                    modelName: schemaMockModelName,
                })).rejects.toThrow('rong id argument');
            });
            it('should throw when the inputObj argument is wrong', async () => {
                let result = await addObjectToDb(modelObjectMock, schemaMockModelName, 'generics');
                const modelObjectMockId = result._id.toString();
                await expect(generics.update({
                    id: modelObjectMockId,
                    inputObj: '',
                    modelName: schemaMockModelName,
                })).rejects.toThrow('rong inputObj argument');
            });
        });
        describe('delete', () => {
            it('should return the deleted object (user) if it exists', async () => {
                let result = await addObjectToDb(modelObjectMock, schemaMockModelName, 'generics');
                const modelObjectMockId = result._id.toString();
                result = await generics.delete({
                    id: modelObjectMockId,
                    modelName: schemaMockModelName,
                });
                expect(result).toHaveProperty('withRestrictions');
                expect(result.nonSelectable).toEqual(undefined);
            });
            it('should throw if the deleted object (user) does not exist', async () => {
                const modelObjectMockId = modelObjectMock._id.toString();
                await expect(generics.delete({
                    id: modelObjectMockId,
                    modelName: schemaMockModelName,
                })).rejects.toThrow('ailed to delete');
            });
            it('should throw if the id argument is undefined', async () => {
                await expect(generics.delete({
                    modelName: schemaMockModelName,
                })).rejects.toThrow('rong id argument');
            });
        });
    });
    describe('user', () => {
        beforeEach(async () => {
            await testH.fn.cleanUserMocks(db);
        });
        afterAll(async () => {
            await testH.fn.cleanUserMocks(db);
        });

        it('should allow to add users and hide the password', async () => {
            let newUser;
            await expect((async () => {
                newUser = await addObjectToDb(testH.userMocks.basic(), 'data.user');
            })()).resolves.not.toThrow();
            expect(newUser).toBeTruthy();
            expect(newUser).toHaveProperty('_id');
            expect(newUser.password).toEqual(undefined);
        });
        it('should allow to update users and hide the password', async () => {
            let newUser = await addObjectToDb(testH.userMocks.basic(), 'data.user');
            const newUserId = newUser._id.toString();
            let updatedUser;
            await expect((async () => {
                updatedUser = await api.controllers['data.user'].update({
                    id: newUserId,
                    inputObj: {
                        username: testH.userMocks.alt().username
                    }
                });
            })()).resolves.not.toThrow();
            expect(updatedUser).toHaveProperty('username');
            expect(updatedUser.username).toBe(testH.userMocks.alt().username);
            expect(updatedUser.password).toEqual(undefined);
        });
        it('should allow to get users', async () => {
            let newUser = await addObjectToDb(testH.userMocks.basic(), 'data.user');
            const newUserId = newUser._id.toString();
            let retrievedUser;
            await expect((async () => {
                retrievedUser = await api.controllers['data.user'].get({
                    id: newUserId
                });
            })()).resolves.not.toThrow();
            expect(newUserId).toBe(retrievedUser._id.toString());
        });
        it('should allow to delete users', async () => {
            let newUser = await addObjectToDb(testH.userMocks.basic(), 'data.user');
            const newUserId = newUser._id.toString();
            let retrievedUser;
            await expect((async () => {
                await api.controllers['data.user'].delete({
                    id: newUserId
                });
                retrievedUser = await api.controllers['data.user'].get({
                    id: newUserId
                });
            })()).resolves.not.toThrow();
            expect(retrievedUser).toEqual([]);
        });
    });
});