'use strict';

const db = require('../../app/db').mongo.models;

module.exports = {
    userMocks: {
        basic: () => {
            return {
                login: '_mocklogin',
                password: '_mockPassword',
                _id: '5dee547d2e93312328a12542',
                role: 'user'
            };
        },
        alt: () => {
            return {
                login: '_mocklogin2',
                password: '_mockPassword2',
                _id: '5dee547d2e93312328a12541',
                role: 'user'
            };
        },
        admin: () => {
            return {
                login: '_mockloginadmin',
                password: '_mockPasswordAdmin',
                _id: '5dee547d2e93312328a12540',
                role: 'admin'
            };
        }
    },
    fn: {
        cleanMockUsers: async () => {
            await db['data.user'].deleteMany({login: module.exports.userMocks.basic().login});
            await db['data.user'].deleteMany({login: module.exports.userMocks.alt().login});
            return await db['data.user'].deleteMany({login: module.exports.userMocks.admin().login});
        },
    }
};