'use strict';

const passport = require('passport');
const logger = require('../../logger').appLogger;
const h = require('../../helpers');

module.exports = (req, res, next) => {
    passport.authenticate('register', {session: false}, (error, user, info) => {
        if (error || !user) {
            logger.error(`Error while registering: ${error}, ${h.optionalStringify(info)}`, {identifier: 'router register'});
            return res.status(500).jsonp(h.generateResponse(false, null, h.optionalStringify(error)));
        }
        req.login(user, {session: false}, (error) => {
            if (error) {
                logger.error(`Error while logging in after registration: ${error}, ${h.optionalStringify(info)}`, {identifier: 'router register'});
                return res.status(500).jsonp(h.generateResponse(false, null, error));
            }
            const token = h.generateJwt(user);
            logger.verbose(`Generated a new token for user: ${user.login}`, {identifier: 'router register'});
            return res.status(200).jsonp(h.generateResponse(true, token, error));
        });
    })(req, res, next);
};