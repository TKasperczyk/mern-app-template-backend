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
                username: '_usernamemock', //Lower case because it's .toLower'ed in the db
                password: '_passwordMock',
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
                username: '_usernamemock2', //Lower case because it's .toLower'ed in the db
                password: '_passwordMock2',
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
                username: '_usernamemockadmin', //Lower case because it's .toLower'ed in the db
                password: '_passwordMockAdmin',
                _id: mongoose.Types.ObjectId().toString(),
                role: 'admin'
            };
        }
    },
    mongooseMocks: {
        schema: {
            /**
             * @description registers a mock mongoose model with predefined properties for mocking. Adds it to the db module. Skips the model registration if it already exists in mongoose
             * @param {Object} [db] "mongo" property of the db module (db.mongo)
             * @returns {Object} the defined model
             */
            basic: (db) => {
                const basicModelName = 'test.basicModel';
                //Avoid defining the same schema twice
                if (db.models[basicModelName]){
                    return db.models[basicModelName];
                }
                const modelSchema = new mongoose.Schema({
                    withRestrictions: {
                        match: /^[a-zA-Z0-9_]{1,}$/,
                        unique: true,
                        required: true,
                        type: String,
                        trim: true,
                        lowercase: true,
                    },
                    nonSelectable: {
                        match: /^.{1,}$/,
                        select: false,
                        required: true,
                        type: String,
                    },
                    simpleString: {
                        required: true,
                        type: String,
                        default: 'user'
                    }
                }, {
                    collection: 'test.basicModels'
                });
                const basicModel = mongoose.model(basicModelName, modelSchema);
                db.models[basicModelName] = basicModel;
                return db.models[basicModelName];
            }
        },
        modelObjects: {
            /**
             * @description generates an object compliant to mongooseMocks.schema.basic
             * @returns {Object} the model mock object
             */
            basic: () => {
                return {
                    withRestrictions: '_withrestrictions', //Lower case because it's .toLower'ed in the schema
                    nonSelectable: 'nonSelectable',
                    _id: mongoose.Types.ObjectId().toString(),
                    simpleString: 'simpleString'
                };
            },
            /**
             * @description generates an object compliant to mongooseMocks.schema.basic
             * @returns {Object} the model mock object
             */
            alt: () => {
                return {
                    withRestrictions: '_withrestrictionsalt', //Lower case because it's .toLower'ed in the schema
                    nonSelectable: 'nonSelectableAlt',
                    _id: mongoose.Types.ObjectId().toString(),
                    simpleString: 'simpleStringAlt'
                };
            }
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
        cleanUserMocks: async (db) => {
            await db.models['data.user'].deleteMany({username: module.exports.userMocks.basic().username});
            await db.models['data.user'].deleteMany({username: module.exports.userMocks.alt().username});
            await db.models['data.user'].deleteMany({username: module.exports.userMocks.admin().username});
        },
        /**
         * @description clears all the collections created by mongooseMocks.schema.*
         * @param {Object} [db] "mongo" property of the db module (db.mongo)
         */
        cleanModelMocks: async (db) => {
            const toClean = module.exports.mongooseMocks.schema;
            //Clear every mock mock model's collection
            for (let key in toClean){
                const model = toClean[key](db);
                await model.deleteMany({});
            }
        },
        /**
         * @description drops all the collections created by mongooseMocks.schema.*
         * @param {Object} [db] "mongo" property of the db module (db.mongo)
         */
        dropModelMocks: async (db) => {
            const toDrop = module.exports.mongooseMocks.schema;
            const modelObjects = module.exports.mongooseMocks.modelObjects;
            //Drop every mock mock model's collection
            for (let key in toDrop){
                //We need to first create a model in the collection before we can drop it. Otherwise the collection might not get completely dropped (only truncated)
                const model = toDrop[key](db);
                const modelObject = modelObjects[key]();
                //This might fail because of duplicate keys or other restrictions - we don't care
                try{
                    const newModel = new model(modelObject);
                    await newModel.save();
                } catch (error){};
                await model.collection.drop();
            }
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