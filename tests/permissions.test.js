const rewire = require('rewire');
const testH = require('./helpers');
const permissions = rewire('../app/permissions');

const permissionsMock = {
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
    it('should throw if the permissions file doesn\'t exist', () => {
        const currentPath = permissions.__get__('permissionsPath');
        const wrongPathMock = 'wrongPath';
        permissions.__set__('permissionsPath', wrongPathMock);
        expect(permissions.__get__('loadPermissionsJson')).toThrow();
        permissions.__set__('permissionsPath', currentPath);
    });
    it('should not throw the permissions file doesn\'t exist', () => {
        const currentPath = permissions.__get__('permissionsPath');
        const wrongPathMock = 'wrongPath';
        permissions.__set__('permissionsPath', wrongPathMock);
        expect(permissions.__get__('loadPermissionsJson')).toThrow();
        permissions.__set__('permissionsPath', currentPath);
    });
    it('should throw if the permissions role doesn\'t contain an object', () => {
        const wrongPermissionsMock = {
            'admin': 'wrongValue'
        };
        permissions.__set__('permissions', wrongPermissionsMock);
        expect(permissions.__get__('validatePermissions')).toThrow('permissions.admin isn\'t an object');
    });
    it('should throw if the permissions role contains a non-existing database model', () => {
        const wrongPermissionsMock = {
            'admin': {
                'notExistingModel': ''
            }
        };
        permissions.__set__('permissions', wrongPermissionsMock);
        expect(permissions.__get__('validatePermissions')).toThrow('There\'s no model called notExistingModel defined in mongoose');
    });
    it('should throw if the permissions model contains a string that\'s not equal to "*"', () => {
        const wrongPermissionsMock = {
            'admin': {
                'data.user': 'wrongStringValue'
            }
        };
        permissions.__set__('permissions', wrongPermissionsMock);
        expect(permissions.__get__('validatePermissions')).toThrow('Unknown value for permissions.[admin][data.user]. Supported values: "*", object');
    });
    it('should throw if the permissions model contains an object with an unknown action', () => {
        const wrongPermissionsMock = {
            'admin': {
                'data.user': {
                    'unknownActionName': ''
                }
            }
        };
        permissions.__set__('permissions', wrongPermissionsMock);
        expect(permissions.__get__('validatePermissions')).toThrow('Unknown action name for permissions[admin][data.user]: unknownActionName. Supported actions: add, get, update, delete');
    });
    it('should throw if the permissions action is a string that\'s not equal to "function"', () => {
        const wrongPermissionsMock = {
            'admin': {
                'data.user': {
                    'add': 'wrongStringValue'
                }
            }
        };
        permissions.__set__('permissions', wrongPermissionsMock);
        expect(permissions.__get__('validatePermissions')).toThrow('Unknown value for permissions[admin][data.user][add] Supported values: "function", boolean');
    });
    it('should throw if the permissions action is a function that doesn\'t exist in permissionFunctions', () => {
        const wrongPermissionsMock = {
            'admin': {
                'data.user': {
                    'add': 'function'
                }
            }
        };
        permissions.__set__('permissions', wrongPermissionsMock);
        expect(permissions.__get__('validatePermissions')).toThrow('Permission parsing error: There\'s no function defined for permissions[admin][data.user][add]. Go to /app/permissions/permissionFunctions.js and define it');
    });
    it('should throw if the permissions action is not a string or a boolean', () => {
        const wrongPermissionsMock = {
            'admin': {
                'data.user': {
                    'add': {}
                }
            }
        };
        permissions.__set__('permissions', wrongPermissionsMock);
        expect(permissions.__get__('validatePermissions')).toThrow('Permission parsing error: Unknown value type for permissions[admin][data.user][add]. Supported values: \"function\", boolean');
    });
    describe('module', () => {
        beforeAll(() => {
            permissions.__set__('permissionFunctions', permissionFunctionsMock);
            permissions.__set__('permissions', permissionsMock);
        });
        it('should return false if the user doesn\'t have permissions to the given model | value-based', () => {
            const userMock = testH.userMocks.basic();
            const actionNameMock = 'add';
            const modelNameMock = 'data.user';
            expect(permissions(userMock.role, modelNameMock, actionNameMock, {
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
            expect(permissions(userMock.role, modelNameMock, actionNameMock)).toBe(true);
        });
        it('should return false if the user doesn\'t have permissions to the given model | function-based', () => {
            const userMock = testH.userMocks.basic();
            const actionNameMock = 'update';
            const modelNameMock = 'data.user';
            expect(permissions(userMock.role, modelNameMock, actionNameMock, {
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
            expect(permissions(userMock.role, modelNameMock, actionNameMock, {
                data: {
                    id: userMock._id
                },
                user: userMock
            })).toBe(true);
        });
        it('should detect function-based configuration errors', () => {
            expect(permissions.__get__('validatePermissions')).not.toThrow();
            //Clone
            const brokenMockPermissionFunctions = JSON.parse(JSON.stringify(permissionFunctionsMock));
            delete brokenMockPermissionFunctions.user['data.user'].get;
            permissions.__set__('permissionFunctions', brokenMockPermissionFunctions);
            expect(permissions.__get__('validatePermissions')).toThrow();
            permissions.__set__('permissionFunctions', permissionFunctionsMock);
            expect(permissions.__get__('validatePermissions')).not.toThrow();
        });
        it('should detect value-based configuration errors', () => {
            expect(permissions.__get__('validatePermissions')).not.toThrow();
            //Clone
            const brokenMockPermissions = JSON.parse(JSON.stringify(permissionsMock));
            brokenMockPermissions.user['data.user'].get = 'random string';
            permissions.__set__('permissions', brokenMockPermissions);
            expect(permissions.__get__('validatePermissions')).toThrow();
            permissions.__set__('permissions', permissionsMock);
            expect(permissions.__get__('validatePermissions')).not.toThrow();
        });
    });
});