'use strict';

/**
    Sets up the whole routing and access to certain functionalities. Exposes the router object which can be injected as a middleware to express
**/

const passport = require('passport');
const router = require('express').Router();
const h = require('../helpers');
const acl = require('../acl');
const permissions = require('../permissions').check;
const logger = require('../logger').appLogger;
const api = require('../api');
const loginMiddleware = require('./middleware/login');
const logoutMiddleware = require('./middleware/logout');
const registerMiddleware = require('./middleware/register');
const notFoundMiddleware = require('./middleware/notFound');


/**
    Parses the routes object (defined in module.exports) and puts the routes in the express.Router instance
**/
const registerRoutes = (routes, method) => {
    for (let key in routes){ //For method route do a recursive call with its name as the second argument
        if(typeof routes[key] === 'object' && routes[key] !== null && !(routes[key] instanceof Array)){
            registerRoutes(routes[key], key); //If the current object isn't a route, it's a method name which contains all of the method's routes
        } else { //This will be true if the routes[key] is a route and the key is a method name
            logger.setup(`Registering a ${method.toUpperCase()} route to ${key}`, {identifier: 'router'});
            if (method === 'get'){
                router.get(key, routes[key]);
            } else if (method === 'post'){
                router.post(key, routes[key]);
            } else if (method === 'delete'){
                router.delete(key, routes[key]);
            } else if (method === 'patch'){
                router.patch(key, routes[key]);
            }
        }
    }
};

/**
    Sends a negative response to the client
**/
const handleError = (req, res, error, statusCode = 500) => {
    logger.error(`Error (req by ${req.user.login}): ${h.optionalStringify(error)}`, {identifier: `router ${req.method} ${req.url}`, meta: {query: req.query, params: req.params}});
    return res.status(statusCode).jsonp(h.generateResponse(false, null, `Something went wrong while performing an API call: ${h.optionalStringify(error)}`));
};

/**
    Performs a call to apiFunc expecting that it will return a promise and SOME value. It passes the args object to it as an argument. Calls successCallback if everything went fine. Sends a response to the client.
**/
const performApiCall = ({req, res, apiFunc, args, successCallback, logging = true, directPipe = false, directPipeHeaders = []}) => {
    const callId = h.generateCallId();
    logger.verbose(`${req.user.login} called ${apiFunc.name}`, {callId, identifier: `router ${req.method} ${req.url}`, logging, meta: {query: req.query, params: req.params, args}});
    apiFunc(Object.assign({}, args, {callId})).then((result) => {
        if (result === undefined){
            return handleError(req, res, 'API func returned nothing');
        } else {
            if (typeof successCallback === 'function'){
                return successCallback(req, res, result);
            } else if (directPipe){
                directPipeHeaders.forEach((header) => {
                    res.setHeader(header.name, header.value);
                });
                return result.pipe(res);
            } else {
                return res.status(200).jsonp(h.generateResponse(true, result, ''));
            }
        }
    }).catch((error) => {
        return handleError(req, res, error);
    });
};

/**
    Uses the registerRoutes function to generate routing for the given routes object.
    Inserts the login route
**/
const route = (routes) => {
    //Allow users to log in and receive a JWT token
    router.post('/api/login', loginMiddleware);
    //Allow users to log out and destroy the session (the token will still be valid)
    router.get('/api/logout', logoutMiddleware);
    //Allow users to register and receive a JWT token
    router.post('/api/signup', registerMiddleware);
    //Secure all routes with JWT authentication
    router.use(
        passport.authenticate('jwt', { session: false, failWithError: true }), 
        (req, res, next) => {
            next();
        }, (err, req, res, next) => {
            return res.status(401).send(h.generateResponse(false, null, 'Unauthorized'));
        }
    );
    //Secure all routes with an access list
    router.use(acl.authorize.unless({
        path: [
            '/api/login',
            '/api/logout',
            '/api/signup'
        ]
    }));
    //Register the routes object
    registerRoutes(routes);
    //If no route was found, send 404
    router.use(notFoundMiddleware);
    return router;
};

module.exports = () => {
    permissions.init();
    /**
        An ordered list of routes that are secured by JWT auth and the access list module
    **/
    const routes = {
        'get': {
            '/api/user/:id?': (req, res) => {
                if (!permissions(req.user.role, 'data.user', 'get', {data: {id: req.params.id}, user: req.user})){
                    return handleError(req, res, 'You don\'t have sufficient permissions to perform this action', 401);
                }
                performApiCall({req, res, apiFunc: api.user.get, args: { id: req.params.id }});
            },
        },
        'post': {
        },
        'patch': {
            '/api/user/:id': (req, res) => {
                if (!h.checkMandatoryArgs({argMap: { data: true }, args: req.body})){
                    return handleError(req, res, 'Incorrect or incomplete arguments', 400);
                }
                if (!permissions(req.user.role, 'data.user', 'update', {data: {id: req.params.id}, user: req.user})){
                    return handleError(req, res, 'You don\'t have sufficient permissions to perform this action', 401);
                }
                //Don't allow to update roles
                delete req.body.data.role;
                //Make sure that the password is stored as a hash
                if (typeof req.body.data.password === 'string' && req.body.data.password.length > 0){
                    req.body.data.password = h.generateHash(req.body.data.password);
                } else {
                    delete req.body.data.password;
                }
                performApiCall({req, res, apiFunc: api.user.update, args: { id: req.params.id, user: req.body.data }});
            },
        },
        'delete': {
            '/api/user/:id': (req, res) => {
                if (!permissions(req.user.role, 'data.user', 'delete', {data: {id: req.params.id}, user: req.user})){
                    return handleError(req, res, 'You don\'t have sufficient permissions to perform this action', 401);
                }
                performApiCall({req, res, apiFunc: api.user.delete, args: {id: req.params.id}});
            },
        }
    };
    return route(routes); //Return an express Router instance
};
