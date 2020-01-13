'use strict';

const logger = require('../../logger').appLogger;

module.exports = (req, res, next) => {
    logger.verbose(`${req.connection.remoteAddress} tried to access a non-existing route: ${req.method} ${req.path}`, {identifier: 'router notFound'});
    res.sendStatus(404);
};