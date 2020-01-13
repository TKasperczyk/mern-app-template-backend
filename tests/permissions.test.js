const rewire = require('rewire');
const testH = require('./helpers');
const permissions = rewire('../app/permissions');

const mockPermissions = {
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
const mockPermissionFunctions = {
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
    beforeAll(() => {
        permissions.__set__('permissionFunctions', mockPermissionFunctions);
        permissions.__set__('permissions', mockPermissions);
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
        const brokenMockPermissionFunctions = JSON.parse(JSON.stringify(mockPermissionFunctions));
        delete brokenMockPermissionFunctions.user['data.user'].get;
        permissions.__set__('permissionFunctions', brokenMockPermissionFunctions);
        expect(permissions.__get__('validatePermissions')).toThrow();
        permissions.__set__('permissionFunctions', mockPermissionFunctions);
        expect(permissions.__get__('validatePermissions')).not.toThrow();
    });
    it('should detect value-based configuration errors', () => {
        expect(permissions.__get__('validatePermissions')).not.toThrow();
        //Clone
        const brokenMockPermissions = JSON.parse(JSON.stringify(mockPermissions));
        brokenMockPermissions.user['data.user'].get = 'random string';
        permissions.__set__('permissions', brokenMockPermissions);
        expect(permissions.__get__('validatePermissions')).toThrow();
        permissions.__set__('permissions', mockPermissions);
        expect(permissions.__get__('validatePermissions')).not.toThrow();
    });
});