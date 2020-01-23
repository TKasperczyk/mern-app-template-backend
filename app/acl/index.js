'use strict';

/**
 * Protects Express routes with an access list. The rules are defined in /config/acl.json
 * Documentation: https://github.com/nyambati/express-acl
 */

const acl = require('express-acl');
const h = require('../helpers');

acl.config({
    baseUrl: '/',
    filename: 'acl.json',
    path: 'config',
    decodedObjectName: 'user',
    roleSearchPath: 'user.role',
    denyCallback: (res) => {
        return res.status(401).jsonp(
            h.generateResponse({status: false, error: 'Access violation error'})
        );
    }
}, {
    status: 'No access',
    message: 'You do not have access to this route'
});

module.exports = acl;
