'use strict';

/**
    Functionalities of the auth module:
    - serializing and deserializing a user
    - checking if the supplied credentials are correct
    - creating passport authentication strategies
    - authorizing socket.io connections
**/

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
    Checks the supplied password and login against the user's mongoDB record
**/
const localAuthProcessor = async (req, login, password, done) => {
    logger.debug(`Starting to authenticate: ${login}`, {identifier: 'auth localAuthProcessor'});
    try {
        const user = await db.models['data.user'].findOne({login}).select('+password').lean(); //Lean because other functions depending on the user object don't use .toObject
        if (!user){ //If the user wasn't found
            logger.warn(`Login attempt failed from ${req.connection.remoteAddress}: user '${login}' doesn't exist`, {identifier: 'auth localAuthProcessor'});
            return done('Authentication error', false);
        } else if (!h.isValidPassword(user, password)){ //If the user was found, but his password wasn't valid
            logger.warn(`Login attempt failed from ${req.connection.remoteAddress}: password for '${login}' is incorrect`, {identifier: 'auth localAuthProcessor'});
            return done('Authentication error', false);
        } else { //Everything ok
            logger.silly(`Login attempt of '${login}' succeeded from ${req.connection.remoteAddress}`, {identifier: 'auth localAuthProcessor'});
            delete user.password;
            return done(null, user);
        }
    } catch(error) {
        logger.error(`Error while trying to find a user '${login}': ${h.optionalStringify(error)}`, {identifier: 'auth localAuthProcessor'});
        return done('Unknown authentication error', false);
    }
};

/**
    Checks the supplied jwtPayload's user ID against the user's mongoDB record
**/
const jwtAuthProcessor = async (req, jwtPayload, done) => {
    logger.debug(`Starting to authenticate '${jwtPayload.login}'`, {identifier: 'auth jwtAuthProcessor'});
    try{
        //Extract the user's ID and check if it exists in the database
        const user = await db.models['data.user'].findById(jwtPayload._id).select('-password').lean(); //Lean because other functions depending on the user object don't use .toObject
        if (!user){ //If the user wasn't found, throw an auth error
            logger.warn(`Login attempt failed from '${req.connection.remoteAddress}': user '${jwtPayload.login}' doesn't exist`, {identifier: 'auth jwtAuthProcessor'});
            return done('Authentication error', false);
        } else { //Everything ok, proceed
            logger.silly(`Login attempt of '${jwtPayload.login}' succeeded from '${req.connection.remoteAddress}'`, {identifier: 'auth jwtAuthProcessor'});
            return done(null, user);
        }
    } catch(error) {
        logger.error(`Error while trying to find a user '${jwtPayload.login}': ${h.optionalStringify(error)}`, {identifier: 'auth jwtAuthProcessor'});
        return done('Unknown authentication error', false);
    }
};

/** 
    Creates a new user if the login isn't already taken.
    Sets the role to: user
**/
const registerProcessor = async (req, login, password, done) => {
    logger.verbose(`Starting to register a new user: ${login}`, {identifier: 'auth registerProcessor'});
    try {
        const user = await db.models['data.user'].findOne({login}).select('-password').lean(); //Lean because other functions depending on the user object don't use .toObject
        if (user){ //If the user was found
            logger.warn(`Register attempt failed from ${req.connection.remoteAddress}: user ${login} already exists`, {identifier: 'auth registerProcessor'});
            return done('Username already taken', false);
        } else { //Everything ok
            const hashedPassword = h.generateHash(password);
            const user = await db.models['data.user'].create({login, password: hashedPassword, role: 'user'});
            logger.debug(`Register attempt of ${login} succeeded from ${req.connection.remoteAddress}`, {identifier: 'auth registerProcessor'});
            const userObj = user.toObject();
            delete userObj.password;
            return done(null, userObj);
        }
    } catch(error) {
        logger.error(`Error while trying to find a user ${login}: ${h.optionalStringify(error)}`, {identifier: 'auth registerProcessor'});
        return done('Unknown authentication error', false);
    }
};

module.exports = (io) => {
    passport.use('login', new localStrategy({
        passReqToCallback: true,
        usernameField: 'login',
        passwordField: 'password',
        session: false
    }, localAuthProcessor));
    passport.use('jwt', new jwtStrategy({
        passReqToCallback: true,
        usernameField: 'login',
        passwordField: 'password',
        jwtFromRequest: jwtExtrator.fromAuthHeaderAsBearerToken(),
        secretOrKey: config.jwtKey,
        jsonWebTokenOptions: {
            maxAge: '1d'
        }
    }, jwtAuthProcessor));
    passport.use('register', new localStrategy({
        passReqToCallback: true,
        usernameField: 'login',
        passwordField: 'password',
        session: false
    }, registerProcessor));

    if (io){
        //Check if the request URL contains an auth token (JWT)
        io.use((socket, next) => {
            logger.silly(`New socket.io connection request incoming`, {identifier: 'auth socket'});
            let parsedReqUrl;
            try{
                parsedReqUrl = url.parse(socket.request.url, true);
            } catch (error){
                socket.conn.close();
                logger.error(`Error while parsing a socket request URL: ${h.optionalStringify(error)}`, {identifier: 'auth socket'});
            }
            if (!parsedReqUrl.query.token){
                socket.conn.close();
                logger.warn('The provided socket URL doesn\'t contain an auth token', {identifier: 'auth socket', meta: {query: parsedReqUrl.query}});
            }
            try{
                jwt.decode(parsedReqUrl.query.token);
            } catch (error){
                socket.conn.close();
                logger.error(`Error while parsing a socket request auth token: ${h.optionalStringify(error)}`, {identifier: 'auth socket'});
            }
            next();
        });
        //Secure socket.io with JWT auth
        io.use(passportJwtSocketIo.authorize({
            jwtFromRequest: jwtExtrator.fromUrlQueryParameter('token'),
            secretOrKey: config.jwtKey
        }, (jwtPayload, done) => {
            jwtAuthProcessor({
                connection: {
                    remoteAddress: 'websocket'
                }
            }, jwtPayload, done);
        }));
    }
    return {
        __private: {
            registerProcessor,
            localAuthProcessor,
            jwtAuthProcessor
        }
    };
};
