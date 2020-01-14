'use strict';

const db = require('../../app/db').mongo;

module.exports = {
    userMocks: {
        basic: () => {
            return {
                login: '_mocklogin',
                password: '_mockPassword',
                _id: db.mongoose.Types.ObjectId().toString(),
                role: 'user'
            };
        },
        alt: () => {
            return {
                login: '_mocklogin2',
                password: '_mockPassword2',
                _id: db.mongoose.Types.ObjectId().toString(),
                role: 'user'
            };
        },
        admin: () => {
            return {
                login: '_mockloginadmin',
                password: '_mockPasswordAdmin',
                _id: db.mongoose.Types.ObjectId().toString(),
                role: 'admin'
            };
        }
    },
    fn: {
        cleanMockUsers: async () => {
            await db.models['data.user'].deleteMany({login: module.exports.userMocks.basic().login});
            await db.models['data.user'].deleteMany({login: module.exports.userMocks.alt().login});
            return await db.models['data.user'].deleteMany({login: module.exports.userMocks.admin().login});
        },
    }
};