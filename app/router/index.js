'use strict';

/**
 * Sets up the whole routing and access to the routes. Exposes the router object which can be injected as a middleware to express
 */
const passport = require('passport');
const router = require('express').Router();
const h = require('../helpers');
const acl = require('../acl');
const permissions = require('../permissions');
const logger = require('../logger').appLogger;
const api = require('../api');
const loginMiddleware = require('./middleware/login');
const registerMiddleware = require('./middleware/register');
const notFoundMiddleware = require('./middleware/notFound');

/**
 *  An ordered list of routes that are secured by JWT auth, the acl module and the permissions module
 */
const routes = {
    'get': {
        '/api/user/:id?': (req, res) => {
            if (!permissions.check(req.user.role, 'data.user', 'get', {data: {id: req.params.id}, user: req.user})){
                return handleError(req, res, 'You don\'t have sufficient permissions to perform this action', 401);
            }
            performApiCall({req, res, apiFunc: api.controllers['data.user'].get, args: { id: req.params.id }});
        },
    },
    'post': {
    },
    'patch': {
        '/api/user/:id': (req, res) => {
            if (!h.checkMandatoryArgs({argMap: { data: true }, args: req.body})){
                return handleError(req, res, 'Incorrect or incomplete arguments', 400);
            }
            if (!permissions.check(req.user.role, 'data.user', 'update', {data: {id: req.params.id}, user: req.user})){
                return handleError(req, res, 'You don\'t have sufficient permissions to perform this action', 401);
            }
            //Don't allow to update roles
            delete req.body.data.role;
            //Make sure that the password is stored as a hash
            if (typeof req.body.data.password === 'string' && req.body.data.password.length > 0){
                req.body.data.password = h.generateHash({password: req.body.data.password});
            } else {
                delete req.body.data.password;
            }
            performApiCall({req, res, apiFunc: api.controllers['data.user'].update, args: { id: req.params.id, user: req.body.data }});
        },
    },
    'delete': {
        '/api/user/:id': (req, res) => {
            if (!permissions.check(req.user.role, 'data.user', 'delete', {data: {id: req.params.id}, user: req.user})){
                return handleError(req, res, 'You don\'t have sufficient permissions to perform this action', 401);
            }
            performApiCall({req, res, apiFunc: api.controllers['data.user'].delete, args: {id: req.params.id}});
        },
    }
};

/**
    Parses the routes object and puts the routes in the express.Router instance
**/
/**
 * @description registers all the routes from the "routes" object in the express router instance. Works recursively
 * @param {Object} [routes] the object defined at the beginning of this module
 * @param {String} [method] the HTTP req method from the routes object - used for recursion, shouldn't be specified when calling this function outside of it
 */
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
/**
 * @description sends a negative response to the client with an error message
 * @param {Object} [req] express request object
 * @param {Object} [res] express response object
 * @param {Object|String} [error] either an error message or an object containing the error message
 * @param {Number} [statusCode = 500] the status code to set on the response
 * @returns {typeof res.status(Number)} the result of res.status(statusCode)
 */
const handleError = (req, res, error, statusCode = 500) => {
    const optionallyStringifiedError = h.optionalStringify(error);
    logger.error(`Error (req by ${req.user.login}): ${optionallyStringifiedError}`, {identifier: `router ${req.method} ${req.url}`, meta: {query: req.query, params: req.params}});
    return res.status(statusCode).jsonp(
        h.generateResponse({
            status: false, 
            error: `Something went wrong while performing an API call: ${optionallyStringifiedError}`
        })
    );
};

/**
 * @description performs a call to the given API function expecting that it will return a promise and SOME value. It passes the given args object to that function. Calls and returns the given successCallback with req, res and the API func result as parameters if everything went fine. If there is no successCallback, sends a standarized response to the client. Allows for sending a piped response instead of the standard response object (e.g. for binary data)
 * @param {Object} [req] express request object
 * @param {Object} [res] express response object
 * @param {Function} [apiFunc] the API function to execute (from the API module)
 * @param {args} [args] the arguments object that will be passed to the API function
 * @param {Function} [successCallback = null] the function that will be called and returned instead of sending a response object to the client
 * @param {Boolean} [logging = true] if false, no log messages will be generated by this function or the passed apiFunc
 * @param {Boolean} [directPipe = false] if true and there's no successCallback defined, it will send a piped response instead. In this case, the api function should return a readstream that has a "pipe" method that will be called with res as the only parameter
 * @param {Array} [directPipeHeaders = []] if directPipe is true, these headers will be set on the res object
 * @returns {*} the result of handleError or successCallback or result.pipe (in case of directPipe) or res.jsonp (in case of all the optional parameters having default values)
 */
const performApiCall = ({req, res, apiFunc, args, successCallback = null, logging = true, directPipe = false, directPipeHeaders = []}) => {
    //Generate a new call id for this request - it will be passed to API functions for tracing the request in our logger
    const callId = h.generateCallId();
    logger.verbose(`${req.user.login} called ${apiFunc.name}`, {callId, identifier: `router ${req.method} ${req.url}`, logging, meta: {query: req.query, params: req.params, args}});
    //Call the API func with the provided arguments and the generated call id 
    apiFunc(Object.assign({}, args, {callId})).then((result) => {
        //Every API function MUST return some result
        if (result === undefined){
            return handleError(req, res, 'API func returned nothing');
        } else {
            //In some cases, this function's logic might not be sufficient, therefore we allow to customize it in the callback
            if (typeof successCallback === 'function'){
                return successCallback(req, res, result); //The whole res logic should be inside the callback
            } else if (directPipe){ //directPipe mode - in this case the result should return a stream that can be piped
                //Set the provided headers if there are any (by default it's an empty array)
                directPipeHeaders.forEach((header) => {
                    res.setHeader(header.name, header.value);
                });
                return result.pipe(res); //Call the result's pipe method
            } else { //This is the most common case - no pipe, no success callback, just a simple standarized response object
                return res.status(200).jsonp(
                    h.generateResponse({
                        status: true, data: result
                    })
                );
            }
        }
    }).catch((error) => { //API functions may throw
        return handleError(req, res, error);
    });
};

/**
    Uses the registerRoutes function to generate routing for the given routes object.
    Inserts the login route
**/
/**
 * @description adds the signup (register), login and notFound routes. Secures every route in the routes object with JWT auth and the acl module
 * @param {Object} [routes] an object containing all the routes that should be registered (i.e. the object defined at the beginning)
 * @returns {Object} an instance of configured Express Router
 */
const route = (routes) => {
    //Allow users to log in and receive a JWT token
    router.post('/api/login', loginMiddleware);
    //Allow users to register and receive a JWT token
    router.post('/api/signup', registerMiddleware);
    //Secure all routes with JWT authentication
    router.use(
        passport.authenticate('jwt', { session: false, failWithError: true }), 
        (req, res, next) => {
            next();
        }, (err, req, res, next) => {
            return res.status(401).send(
                h.generateResponse({
                    status: false, 
                    error: 'Unauthorized'
                })
            );
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

permissions.init();
module.exports = {
    //Return an express Router instance
    instance: route.bind(null, routes),
    __private: { //For tests
        routes,
        performApiCall,
        handleError,
        registerRoutes
    }
};
