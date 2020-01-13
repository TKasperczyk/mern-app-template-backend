'use strict';

const logger = require('../../logger').appLogger;
const h = require('../../helpers');

module.exports = (req, res, next) => {
    req.logout();
    logger.debug(`A user has just logged out`, {identifier: 'router logout'});
    return res.status(200).jsonp(h.generateResponse(true, null, null));
};