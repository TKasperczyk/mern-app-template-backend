'use strict';

/**
    This module is used by the router to protect all routes with predefined permissions - /config/acl.json
**/

const acl = require('express-acl');
const h = require('../helpers');

acl.config({
    baseUrl: '/',
    filename: 'acl.json',
    path: 'config',
    decodedObjectName: 'user',
    roleSearchPath: 'user.role',
    denyCallback: (res) => {
        return res.status(401).jsonp(h.generateResponse(false, null, 'Access violation error'));
    }
}, {
    status: 'No access',
    message: 'You don\'t have access to this route'
});

module.exports = acl;
