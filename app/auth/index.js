'use strict';

/**
 * Functionalities of the auth module:
 * - serializing and deserializing a user
 * - checking if the supplied credentials are correct
 * - creating passport authentication strategies
 * - authorizing socket.io connections
 * It exports a function that registers the three core passport strategies (jwt, register (signup) and local) used in the app.
 * It also exports a function that allows for securing socket.io connections
 */

const passport = require('passport');
const localStrategy = require('passport-local');
const passportJwtSocketIo = require('passport-jwt.socketio');
const jwtStrategy = require('passport-jwt').Strategy;
const jwtExtrator = require('passport-jwt').ExtractJwt;
const jwt = require('jsonwebtoken');
const url = require('url');
const config = require('../config');
const h = require('../helpers');
const db = require('../db').mongo;
const logger = require('../logger').appLogger;

/**
 * @description checks the supplied password and login against the user's mongoDB record
 * @param {Object}   [req] the express request object passed by Passport  
 * @param {String}   [login] the user's login
 * @param {String}   [password] the user's password 
 * @param {Function} [done] the callback - http://www.passportjs.org/docs/configure/#verify-callback
 * @returns {?} the result of calling the callback
 */
const localAuthProcessor = async (req, login, password, done) => {
    logger.debug(`Starting to authenticate: ${login}`, {identifier: 'auth localAuthProcessor'});
    try {
        //Search for a user with the given login in the mongo database
        const user = await db.models['data.user'].findOne({login}).select('+password').lean(); //Lean makes it faster and we don't need to populate anything and we don't need to populate anything
        if (!user){ //If the user wasn't found return an auth error
            logger.warn(`Login attempt failed from ${req.connection.remoteAddress}: user '${login}' doesn't exist`, {identifier: 'auth localAuthProcessor'});
            return done('Authentication error', false);
        } else if (!h.isValidPassword({hashedPassword: user.password, cleartextPassword: password})){ //If the user was found, but his password wasn't correct return an auth error
            logger.warn(`Login attempt failed from ${req.connection.remoteAddress}: password for '${login}' is incorrect`, {identifier: 'auth localAuthProcessor'});
            return done('Authentication error', false);
        } else { //Everything ok, return the found user without his password (for security)
            logger.silly(`Login attempt of '${login}' succeeded from ${req.connection.remoteAddress}`, {identifier: 'auth localAuthProcessor'});
            delete user.password;
            return done(null, user);
        }
    } catch(error) { //Something went wrong, log and return an error
        logger.error(`Error while trying to find a user '${login}': ${h.optionalStringify(error)}`, {identifier: 'auth localAuthProcessor'});
        return done('Unknown authentication error', false);
    }
};

/**
 * @description checks the supplied jwtPayload's user ID against the user's mongoDB record
 * @param {Object}   [req] the express request object passed by Passport  
 * @param {Object}   [jwtPayload] a decoded and parsed JWT containing the user's ID (_id)
 * @param {Function} [done] the callback - http://www.passportjs.org/docs/configure/#verify-callback
 * @returns {?} the result of calling the callback
 */
const jwtAuthProcessor = async (req, jwtPayload, done) => {
    logger.debug(`Starting to authenticate '${jwtPayload.login}'`, {identifier: 'auth jwtAuthProcessor'});
    try{
        //Extract the user's ID and search for it in the mongo database
        const user = await db.models['data.user'].findById(jwtPayload._id).select('-password').lean(); //Lean makes it faster and we don't need to populate anything
        if (!user){ //If the user wasn't found return an auth error
            logger.warn(`Login attempt failed from '${req.connection.remoteAddress}': user '${jwtPayload.login}' doesn't exist`, {identifier: 'auth jwtAuthProcessor'});
            return done('Authentication error', false);
        } else { //Everything ok, return the found user object (the password was already deselected)
            logger.silly(`Login attempt of '${jwtPayload.login}' succeeded from '${req.connection.remoteAddress}'`, {identifier: 'auth jwtAuthProcessor'});
            return done(null, user);
        }
    } catch(error) { //Something went wrong, log and return an error
        logger.error(`Error while trying to find a user '${jwtPayload.login}': ${h.optionalStringify(error)}`, {identifier: 'auth jwtAuthProcessor'});
        return done('Unknown authentication error', false);
    }
};

/**
 * @description creates a new user if the login isn't already taken. Sets the role to: user
 * @param {Object}   [req] the express request object passed by Passport  
 * @param {String}   [login] the user's login
 * @param {String}   [password] the user's password 
 * @param {Function} [done] the callback - http://www.passportjs.org/docs/configure/#verify-callback
 * @returns {?} the result of calling the callback
 */
const registerProcessor = async (req, login, password, done) => {
    logger.verbose(`Starting to register a new user: ${login}`, {identifier: 'auth registerProcessor'});
    try {
        //Search for a user with the given login in the mongo database
        const user = await db.models['data.user'].findOne({login}).select('-password').lean(); //Lean makes it faster and we don't need to populate anything
        if (user){ //If the user was found return an error because logins must be unique
            logger.warn(`Register attempt failed from ${req.connection.remoteAddress}: user ${login} already exists`, {identifier: 'auth registerProcessor'});
            return done('Username already taken', false);
        } else { //Everything ok, create a new user and return it without the password (for security)
            //We store password hashes in the database
            const hashedPassword = h.generateHash({password});
            //Create a new user in the mongo database
            const user = await db.models['data.user'].create({login, password: hashedPassword, role: 'user'});
            logger.debug(`Register attempt of ${login} succeeded from ${req.connection.remoteAddress}`, {identifier: 'auth registerProcessor'});
            //We don't need mongoose stuff in the returned object
            const userObj = user.toObject();
            //Delete the password from the returned object (for security)
            delete userObj.password;
            return done(null, userObj);
        }
    } catch(error) { //Something went wrong, log and return an error
        logger.error(`Error while trying to find a user ${login}: ${h.optionalStringify(error)}`, {identifier: 'auth registerProcessor'});
        return done('Unknown authentication error', false);
    }
};

module.exports = {
    /**
     * @description registers all three Passport strategies and optionally calls secureIo if the io param is defined
     * @param {Object} [io = null] the result of require('socket.io')(httpServer)
     */
    registerStrategies: (io) => {
        passport.use('login', new localStrategy({
            passReqToCallback: true,
            usernameField: 'login',
            passwordField: 'password',
            session: false //No sessions, we only use JWT
        }, localAuthProcessor));
        passport.use('jwt', new jwtStrategy({
            passReqToCallback: true,
            usernameField: 'login',
            passwordField: 'password',
            jwtFromRequest: jwtExtrator.fromAuthHeaderAsBearerToken(),
            secretOrKey: config.jwtKey,
            jsonWebTokenOptions: {
                maxAge: '1d' //That's fixed for now. We can move that to config if needed
            }
        }, jwtAuthProcessor));
        passport.use('register', new localStrategy({
            passReqToCallback: true,
            usernameField: 'login',
            passwordField: 'password',
            session: false //No sessions, we only use JWT
        }, registerProcessor));
        //
        if (io){
            module.exports.secureIo(io);
        }
    },
    /**
     * @description registers a custom middleware that checks whether there's a "token" query parameter in the request. The token must hold a correct JWT. The sole purpuse of this middleware is to close the socket connection when the token is missing or malformed. It should be done by passport-jwt.socketio, but for some reason it's not and we have to do it ourselves. The function also registers the passport-jwt.socketio middleware in the io instance which checks if the token is still valid
     * @param {Object} [io] the result of require('socket.io')(httpServer)
     */
    secureIo: (io) => {
        //Check if the request URL contains an auth token (JWT)
        io.use((socket, next) => {
            logger.silly(`New socket.io connection request incoming`, {identifier: 'auth socket'});
            let parsedReqUrl = null;
            //Try to parse the URL query parameters
            try{
                parsedReqUrl = url.parse(socket.request.url, true); //True to also parse the query params
            } catch (error){ //The URL is unparsable, close the connection and log
                socket.conn.close();
                logger.error(`Error while parsing a socket request URL: ${h.optionalStringify(error)}`, {identifier: 'auth socket'});
            }
            //If the URL wasn't parsed or doesn't contain the token, close the connection and log
            if (!parsedReqUrl || !parsedReqUrl.query.token){
                socket.conn.close();
                logger.warn('The provided socket URL doesn\'t contain an auth token', {identifier: 'auth socket', meta: {query: parsedReqUrl.query}});
            } else { //The URL was parsed and contains the token
                //Try to decode the token (check if it's malformed)
                try{
                    jwt.decode(parsedReqUrl.query.token);
                } catch (error){ //The token is malformed, close the connection and log
                    socket.conn.close();
                    logger.error(`Error while parsing a socket request auth token: ${h.optionalStringify(error)}`, {identifier: 'auth socket'});
                }
            }
            //Despite possibly closing the socket connection, call next to make sure that the request doesn't hang
            next();
        });
        //Secure socket.io with JWT auth
        io.use(passportJwtSocketIo.authorize({
            jwtFromRequest: jwtExtrator.fromUrlQueryParameter('token'),
            secretOrKey: config.jwtKey
        }, (jwtPayload, done) => {
            jwtAuthProcessor({
                connection: { //A simple request "mock". This property is used in the log messages generated by jwtAuthProcessor
                    remoteAddress: 'websocket' //passportJwtSocketIo doesn't pass the socket object to this callback and we can't extract the IP address from jwtPayload
                    //TODO: maybe there's actually a way to extract the address? 
                }
            }, jwtPayload, done);
        }));
    },
    __private: { //For tests
        registerProcessor,
        localAuthProcessor,
        jwtAuthProcessor
    }
};
