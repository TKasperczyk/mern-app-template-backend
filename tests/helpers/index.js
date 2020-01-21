'use strict';

const mongoose = require('mongoose');
const path = require('path');

module.exports = {
    userMocks: {
        basic: () => {
            return {
                login: '_mocklogin',
                password: '_mockPassword',
                _id: mongoose.Types.ObjectId().toString(),
                role: 'user'
            };
        },
        alt: () => {
            return {
                login: '_mocklogin2',
                password: '_mockPassword2',
                _id: mongoose.Types.ObjectId().toString(),
                role: 'user'
            };
        },
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
            malformed: () => {
                return `{}!}`;
            },
        }
    },
    fn: {
        cleanMockUsers: async (db) => {
            await db.models['data.user'].deleteMany({login: module.exports.userMocks.basic().login});
            await db.models['data.user'].deleteMany({login: module.exports.userMocks.alt().login});
            await db.models['data.user'].deleteMany({login: module.exports.userMocks.admin().login});
        },
        setFsMockConfig: ({configString = null, permissionsString = null, aclString = null} = {configString: null, permissionsString: null, aclString: null}) => {
            const fileMocks = {
                [path.resolve(__dirname, '../../config/config.json')]: configString ? configString : module.exports.fileMocks.config.basic(),
                [path.resolve(__dirname, '../../config/permissions.json')]: permissionsString ? permissionsString : module.exports.fileMocks.permissions.basic(),
                [path.resolve(__dirname, '../../config/acl.json')]: aclString ? aclString : module.exports.fileMocks.acl.basic(),
            };
            require('graceful-fs').__setMockFiles(fileMocks);      
        },
        resetAll: ({setupConfig = false} = {setupConfig: false}) => {
            jest.resetModules();
            jest.resetAllMocks();
            if(setupConfig){
                jest.mock('graceful-fs');
                module.exports.fn.setFsMockConfig();
            }
        },
        upsertFsMockFiles: (upsertedFiles) => {
            require('graceful-fs').__setMockFiles(upsertedFiles, {resetOld: false});
        }
    }
};