'use strict';

const passport = require('passport');
const logger = require('../../logger').appLogger;
const h = require('../../helpers');

module.exports = (req, res, next) => {
    passport.authenticate('login', {session: false}, (error, user, info) => {
        if (error || !user) {
            logger.error(`Error while authenticating: ${error}, ${info}`, {identifier: 'router login'});
            return res.status(401).jsonp(h.generateResponse(false, null, 'Unauthorized'));
        }
        req.login(user, {session: false}, (error) => {
            if (error) {
                logger.error(`Error while logging in: ${error}, ${info}`, {identifier: 'router login'});
                return res.status(500).jsonp(h.generateResponse(false, null, error));
            }
            const token = h.generateJwt(user);
            logger.verbose(`Generated a new token for user: ${user.login}`, {identifier: 'router login'});
            return res.status(200).jsonp(h.generateResponse(true, token, error));
        });
    })(req, res, next);
};