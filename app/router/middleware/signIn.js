'use strict';

/**
 * Handles client sign in requests. Generates a new JWT and returns it to the client if the credentials were correct
 */

const passport = require('passport');
const logger = require('../../logger').appLogger;
const h = require('../../helpers');

module.exports = (req, res, next) => {
    passport.authenticate('signIn', {session: false}, (error, user, info) => {
        if (error || !user) {
            logger.error(`Error while authenticating: ${error}`, {identifier: 'router signIn', meta: {info}});
            return res.status(401).jsonp(
                h.generateResponse({
                    status: false, 
                    error: 'Unauthorized'
                })
            );
        }
        req.login(user, {session: false}, (error) => {
            if (error) {
                logger.error(`Error while logging in: ${error}`, {identifier: 'router signIn'});
                return res.status(500).jsonp(
                    h.generateResponse({
                        status: false, 
                        error
                    })
                );
            }
            const token = h.generateJwt({from: user});
            logger.verbose(`Generated a new token for user: ${user.signIn}`, {identifier: 'router signIn'});
            return res.status(200).jsonp(
                h.generateResponse({
                    status: true, 
                    data: token, 
                    error
                })
            );
        });
    })(req, res, next);
};