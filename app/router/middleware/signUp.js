'use strict';

/**
 * Handles client sign up requests. Generates a new JWT and returns it to the client after successfully creating his account
 */

const passport = require('passport');
const logger = require('../../logger').appLogger;
const h = require('../../helpers');

module.exports = (req, res, next) => {
    passport.authenticate('signUp', {session: false}, (error, user, info) => {
        if (error || !user) {
            logger.error(`Error while signing up: ${error}, ${h.optionalStringify(info)}`, {identifier: 'router signUp'});
            return res.status(500).jsonp(
                h.generateResponse({
                    status: false,
                    error
                })
            );
        }
        req.login(user, {session: false}, (error) => {
            if (error) {
                logger.error(`Error while logging in after registration: ${error}, ${h.optionalStringify(info)}`, {identifier: 'router signUp'});
                return res.status(500).jsonp(
                    h.generateResponse({
                        status: false, 
                        error
                    })
                );
            }
            const token = h.generateJwt({from: user});
            logger.verbose(`Generated a new token for user: ${user.username}`, {identifier: 'router signUp'});
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