'use strict';

const testH = require('./helpers');
const permissions = require('../app/permissions');

const permissionsJsonMock = {
    'admin': {
        'data.user': '*'
    },
    'user': {
        'data.user': {
            'add': false,
            'get': 'function',
            'update': 'function',
            'delete': true
        }
    }
};
const permissionFunctionsMock = {
    user: {
        'data.user': {
            get: (data, user) => {
                return data.id == user._id;
            },
            update: (data, user) => {
                return data.id == user._id;
            },
            delete: (data, user) => {
                return data.id == user._id;
            }
        }
    }
};

describe('permissions', () => {
    let permissionFunctions = permissions.__private.permissionFunctions;
    const validatePermissions = permissions.__private.validatePermissions;
    const getPermissionsJson = permissions.__private.getPermissionsJson; 

    it('init should load the permissions JSON', () => {
        expect(permissions.__private.permissionsJson).toEqual(null);
        expect(permissions.init).not.toThrow();
        expect(permissions.__private.permissionsJson).toBeTruthy();
    });
    it('getPermissionsJson should throw if the permissions file doesn\'t exist', () => {
        const wrongPathMock = 'wrongPath';
        expect(getPermissionsJson.bind(null, wrongPathMock)).toThrow();
    });
    describe('validatePermissions', () => {
        it('should throw if the permissions role doesn\'t contain an object', () => {
            const wrongPermissionsMock = {
                'admin': 'wrongValue'
            };
            expect(validatePermissions.bind(null, wrongPermissionsMock, permissionFunctions)).toThrow('permissions.admin isn\'t an object');
        });
        it('should throw if the permissions role contains a non-existing database model', () => {
            const wrongPermissionsMock = {
                'admin': {
                    'notExistingModel': ''
                }
            };
            expect(validatePermissions.bind(null, wrongPermissionsMock, permissionFunctions)).toThrow('no model called notExistingModel defined in mongoose');
        });
        it('should throw if the permissions model contains a string that\'s not equal to "*"', () => {
            const wrongPermissionsMock = {
                'admin': {
                    'data.user': 'wrongStringValue'
                }
            };
            expect(validatePermissions.bind(null, wrongPermissionsMock, permissionFunctions)).toThrow('nknown value for permissions.[admin][data.user]');
        });
        it('should throw if the permissions model contains an object with an unknown action', () => {
            const wrongPermissionsMock = {
                'admin': {
                    'data.user': {
                        'unknownActionName': ''
                    }
                }
            };
            expect(validatePermissions.bind(null, wrongPermissionsMock, permissionFunctions)).toThrow('nknown action name for permissions[admin][data.user]: unknownActionName');
        });
        it('should throw if the permissions action is a string that\'s not equal to "function"', () => {
            const wrongPermissionsMock = {
                'admin': {
                    'data.user': {
                        'add': 'wrongStringValue'
                    }
                }
            };
            expect(validatePermissions.bind(null, wrongPermissionsMock, permissionFunctions)).toThrow('nknown value for permissions[admin][data.user][add]');
        });
        it('should throw if the permissions action is a function that doesn\'t exist in permissionFunctions', () => {
            const wrongPermissionsMock = {
                'admin': {
                    'data.user': {
                        'add': 'function'
                    }
                }
            };
            expect(validatePermissions.bind(null, wrongPermissionsMock, permissionFunctions)).toThrow('no function defined');
        });
        it('should throw if the permissions action is not a string or a boolean', () => {
            const wrongPermissionsMock = {
                'admin': {
                    'data.user': {
                        'add': {}
                    }
                }
            };
            expect(validatePermissions.bind(null, wrongPermissionsMock, permissionFunctions)).toThrow('nknown value type');
        });
    });
    describe('check', () => {
        beforeAll(() => {
            permissions.__private.permissionFunctions = permissionFunctionsMock;
            permissions.__private.permissionsJson = permissionsJsonMock;
        });
        it('should return false if the user doesn\'t have permissions to the given model | value-based', () => {
            const userMock = testH.userMocks.basic();
            const actionNameMock = 'add';
            const modelNameMock = 'data.user';
            expect(permissions.check(userMock.role, modelNameMock, actionNameMock, {
                data: {
                    id: 'randomId'
                },
                user: userMock
            })).toBe(false);
        });
        it('should return true if the user has permissions to the given model | value-based', () => {
            const userMock = testH.userMocks.basic();
            const actionNameMock = 'delete';
            const modelNameMock = 'data.user';
            expect(permissions.check(userMock.role, modelNameMock, actionNameMock)).toBe(true);
        });
        it('should return false if the user doesn\'t have permissions to the given model | function-based', () => {
            const userMock = testH.userMocks.basic();
            const actionNameMock = 'update';
            const modelNameMock = 'data.user';
            expect(permissions.check(userMock.role, modelNameMock, actionNameMock, {
                data: {
                    id: 'randomId'
                },
                user: userMock
            })).toBe(false);
        });
        it('should return true if the user has permissions to the given model | function-based', () => {
            const userMock = testH.userMocks.basic();
            const actionNameMock = 'get';
            const modelNameMock = 'data.user';
            expect(permissions.check(userMock.role, modelNameMock, actionNameMock, {
                data: {
                    id: userMock._id
                },
                user: userMock
            })).toBe(true);
        });
        it('should detect function-based configuration errors', () => {
            expect(validatePermissions.bind(null, permissionsJsonMock, permissionFunctionsMock)).not.toThrow();
            //Clone
            const brokenMockPermissionFunctions = JSON.parse(JSON.stringify(permissionFunctionsMock));
            delete brokenMockPermissionFunctions.user['data.user'].get;
            expect(validatePermissions.bind(null, permissionsJsonMock, brokenMockPermissionFunctions)).toThrow();
        });
        it('should detect value-based configuration errors', () => {
            expect(validatePermissions).not.toThrow();
            //Clone
            const brokenMockPermissionsJson = JSON.parse(JSON.stringify(permissionsJsonMock));
            brokenMockPermissionsJson.user['data.user'].get = 'random string';
            expect(validatePermissions.bind(null, brokenMockPermissionsJson, permissionFunctionsMock)).toThrow();
        });
    });
});