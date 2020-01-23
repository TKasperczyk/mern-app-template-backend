'use strict';

/**
 * A set of helper functions used in our tests
 */

const mongoose = require('mongoose');
const path = require('path');
module.exports = {
    userMocks: {
        /**
         * @description generates a basic user mock with a proper mongoose id (new each time) and a cleartext password - no admin
         * @returns {Object} the user object
         */
        basic: () => {
            return {
                login: '_mocklogin',
                password: '_mockPassword',
                _id: mongoose.Types.ObjectId().toString(),
                role: 'user'
            };
        },
        /**
         * @description generates an alternative user mock with a proper mongoose id (new each time) and a cleartext password - no admin
         * @returns {Object} the user object
         */
        alt: () => {
            return {
                login: '_mocklogin2',
                password: '_mockPassword2',
                _id: mongoose.Types.ObjectId().toString(),
                role: 'user'
            };
        },
        /**
         * @description generates an admin user mock with a proper mongoose id (new each time) and a cleartext password
         * @returns {Object} the user object
         */
        admin: () => {
            return {
                login: '_mockloginadmin',
                password: '_mockPasswordAdmin',
                _id: mongoose.Types.ObjectId().toString(),
                role: 'admin'
            };
        }
    },
    fileMocks: {
        permissions: {
            /**
             * @description generates a basic mock of permissions.json in a stringified form
             * @returns {String} a set of permission rules that can be injected into our graceful.fs mock
             */
            basic: () => {
                return `{
                    "admin": {
                        "data.user": "*"
                    },
                    "user": {
                        "data.user": {
                            "add": false,
                            "get": "function",
                            "update": "function",
                            "delete": "function"
                        }
                    }
                }`;
            },
        },
        acl: {
            /**
             * @description generates a basic mock of acl.json in a stringified form
             * @returns {String} a set of acl rules that can be injected into our graceful.fs mock
             */
            basic: () => {
                return `[{
                    "group": "admin",
                    "permissions": [{
                        "resource": "*",
                        "methods": "*",
                        "action": "allow"
                    }]
                }, {
                    "group": "user",
                    "permissions": [{
                        "resource": "/api/user",
                        "methods": "*",
                        "action": "deny"
                    }, {
                        "resource": "*",
                        "methods": "*",
                        "action": "allow"
                    }]
                }]`;
            },
        },
        config: {
            /**
             * @description generates a basic mock of config.json in a stringified form
             * @returns {String} configuration with db localhost and no auth in a stringified form
             */
            basic: () => {
                return `{
                    "jwtKey": "RANDOMSTRING",
                    "server": {
                        "port": 3001,
                        "rootDomain": "localhost"
                    },
                    "db": {
                        "mongo": {
                            "url": "mongodb://localhost/backend",
                            "user": "user",
                            "host": "localhost",
                            "port": 27017,
                            "password": "pass",
                            "database": "db",
                            "authDb": "authDb",
                            "auth": false
                        },
                        "redis": {
                            "port": 6379,
                            "host": "127.0.0.1",
                            "password": "pass",
                            "auth": false
                        }
                    },
                    "logging": {
                        "disableHttp": false,
                        "maxMetaLength": 500,
                        "prettyMeta": true,
                        "level": "api"
                    },
                    "scheduler": {
                        "example": {
                            "enabled": false,
                            "cronTime": "0 0 * * *",
                            "logging": {
                                "state": true,
                                "debug": true
                            }
                        }
                    }
                }`;
            },
            /**
             * @description generates an alternative mock of config.json in a stringified form
             * @returns {String} configuration with db localhost and no auth in a stringified form
             */
            alt: () => {
                return `{
                    "jwtKey": "ALTRANDOMSTRING",
                    "server": {
                        "port": 3002,
                        "rootDomain": "127.0.0.1"
                    },
                    "db": {
                        "mongo": {
                            "url": "mongodb://127.0.0.1/backend",
                            "user": "userAlt",
                            "host": "127.0.0.1",
                            "port": 27017,
                            "password": "passAlt",
                            "database": "dbAlt",
                            "authDb": "authDbAlt",
                            "auth": false
                        },
                        "redis": {
                            "port": 6379,
                            "host": "localhost",
                            "password": "passAlt",
                            "auth": false
                        }
                    },
                    "logging": {
                        "disableHttp": true,
                        "maxMetaLength": 200,
                        "prettyMeta": false,
                        "level": "silly"
                    },
                    "scheduler": {
                        "example": {
                            "enabled": false,
                            "cronTime": "1 0 * * *",
                            "logging": {
                                "state": false,
                                "debug": false
                            }
                        }
                    }
                }`;
            },
            /**
             * @description generates a malformed mock of config.json in a stringified form
             * @returns {String} unparsable gibberish
             */
            malformed: () => {
                return `{}!}`;
            },
        }
    },
    fn: {
        /**
         * @description removes the basic, alt and admin mock users from the database
         * @param {Object} [db] "mongo" property of the db module (db.mongo)
         */
        cleanMockUsers: async (db) => {
            await db.models['data.user'].deleteMany({login: module.exports.userMocks.basic().login});
            await db.models['data.user'].deleteMany({login: module.exports.userMocks.alt().login});
            await db.models['data.user'].deleteMany({login: module.exports.userMocks.admin().login});
        },
        /**
         * @description uses basic versions of the previously defined file mocks. Allows to pass custom file contents that will be set instead of the generated file mocks. Sets all of them in our graceful-fs mock. You need to call jest.mock('graceful-fs') before using this function
         * @param {String} [configString = null] if defined, it will be used instead of fileMocks.config.basic()
         * @param {String} [permissionsString = null] if defined, it will be used instead of fileMocks.permissions.basic()
         * @param {String} [aclString = null] if defined, it will be used instead of fileMocks.acl.basic()
         */
        setFsMockConfig: ({configString = null, permissionsString = null, aclString = null} = {}) => {
            const fileMocks = {
                [path.resolve(__dirname, '../../config/config.json')]: configString ? configString : module.exports.fileMocks.config.basic(),
                [path.resolve(__dirname, '../../config/permissions.json')]: permissionsString ? permissionsString : module.exports.fileMocks.permissions.basic(),
                [path.resolve(__dirname, '../../config/acl.json')]: aclString ? aclString : module.exports.fileMocks.acl.basic(),
            };
            require('graceful-fs').__setMockFiles(fileMocks);      
        },
        /**
         * @description resets jest modules and mocks. Can optionally mock graceful-fs and set the mock files by calling setFsMockConfig with default parameters
         * @param {Boolean} [setupConfig = false] if true, the function will set crucial mock files in graceful-fs mock
         */
        resetAll: ({setupConfig = false} = {}) => {
            jest.resetModules();
            jest.resetAllMocks();
            if(setupConfig){
                jest.mock('graceful-fs');
                module.exports.fn.setFsMockConfig();
            }
        },
        /**
         * @description allows to upsert the list of mocked files in the graceful-fs mock. You need to call jest.mock('graceful-fs') before using this function
         * @param {Object} [upsertedFiles] an object containing names and contents of files that should be added to our graceful-fs mock
         */
        upsertFsMockFiles: (upsertedFiles) => {
            require('graceful-fs').__setMockFiles(upsertedFiles, {resetOld: false});
        }
    }
};