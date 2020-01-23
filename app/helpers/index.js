'use strict';

/**
 *  Provides helper functions used across the whole project
 */

const bCrypt = require('bcrypt-nodejs');
const jwt = require('jsonwebtoken');
const config = require('../config');

module.exports = {
    /**
     * @description we're assuming that the main worker will have an env id of "1" - the ids are assigned in the main entry file (cluster.js). The function checks if the id is indeed equal to "1"
     * @returns {Boolean} true if the current process is the main (first) worker
     */
    isMasterWorker: () => {
        return process.env.id == '1';
    },
    /**
    * @description generates a response object which can be returned to the client as a response
    * @param {Boolean}  [status = null] the status of the performed action (success or failure)
    * @param {*}        [data = null] the data returned by the performed action
    * @param {String}   [error = null] a possible error message that might be thrown by the performed action
    * @returns {Object} a standarized response to the client's request
    */
    generateResponse: ({status = null, data = null, error = null} = {}) => {
        return {
            status,
            data,
            error,
        };
    },
    /**
     * @description generates a new token based on the provided object. Signs it with the key defined in the configuration
     * @param {Object} [from] the object that will be encoded in the token
     * @param {String} [expiresIn] the expiration time of the generated token. Possible values: https://github.com/auth0/node-jsonwebtoken#Usage
     */
    generateJwt: ({from, expiresIn = '24h'}) => {
        return jwt.sign(from, config.jwtKey, {expiresIn});
    },
    /**
    * @description checks whether the provided args object contains all the arguments described in the arguments map. Optionally allows to perform additional checks on the values of args. The function is mainly used to handle mandatory query parameters in the router.
    * @param {Object} [argMap] - an object with key names representing the "argument names" (keys) that should be present in the args object. If the value of a map key is a function, the function's result will determine whether the argument passes the test. The function should return a boolean and take one argument - the value of the corresponding key in the args object. Otherwise, the value in the map doesn't matter
    * @param {Object} [args] - an object containing the list of arguments.
    * @example 
        checkMandatoryArgs({
            argMap: {
                ip: true, //Check if exists (any value, can even be false or null)
                routerId: (routerId) => { //Function check
                    return routerId > 0 && routerId < 16
                }
            }
            args: {
                ip: "1.2.3.4",
                routerId: -1
            }
        });
    * // returns false; //Because the routerId argument didn't pass the optional function check
    * @returns {Boolean} true if all keys of the argsMap object are present in the args object and all optional functions (if any) returned true
    */
    checkMandatoryArgs: ({argMap, args}) => {
        let allPresent = true;
        let allCorrect = true;
        for (let argName in argMap){
            if (typeof argMap[argName] === `function`){
                if (!argMap[argName](args[argName])){
                    allCorrect = false;
                    break;
                }
            } else {
                if (args[argName] === undefined){
                    allPresent = false;
                    break;
                }
            }
        }
        return allPresent && allCorrect;
    },
    /**
     * @description generates a random number that can be used to track async calls in the logger module. If an argument is passed, it's returned instead of the generated number
     * @param {String} [currentCallId] an optional argument that will be returned if defined
     * @returns {Number or typeof currentCallId} a number ready to pass to the appLogger as a call identifier
     */
    generateCallId: (currentCallId) => {
        return currentCallId === undefined || currentCallId === null ? Math.floor(Math.random() * Math.pow(10, 17)) : currentCallId;
    },
    /**
     * @description generates a password hash from the provided cleartext password
     * @param {String} [password] a cleartext password that will be hashed
     * @param {Number} [rounds = 12] the number of rounds that bCrypt will use. It's starting to get slow above 12 on most systems
     * @returns {String} the generated bCrypt hash
     */
    generateHash: ({password, rounds = 12}) => {
        return bCrypt.hashSync(password, bCrypt.genSaltSync(rounds), null);
    },
    /**
     * @description checks whether the provided password is correct based on the provided hash
     * @param {String} [hashedPassword] the hash to check against
     * @param {String} [cleartextPassword] the plaintext password that will be checked
     * @returns {Boolean} true if the cleartext password is correct
     */
    isValidPassword: ({hashedPassword, cleartextPassword}) => {
        return bCrypt.compareSync(cleartextPassword, hashedPassword);
    },
    /**
    * @description stringifies an object if it can be stringified (unless it's empty)
    * @param {*} [obj] the object to stringify or anything else to return back
    * @returns {String or typeof obj} a stringified version of the argument only if it's an actual object with at least one key. Otherwise, returns the original argument.
    */
    optionalStringify: (obj) => {
        if (obj instanceof Object && (Object.keys(obj)).length > 0){
            return JSON.stringify(obj, null, 4);
        } else {
            return obj;
        }
    },
    /**
    * @description parses an object if it's parsable
    * @param {*} [str] the stringified object to parse or anything else to return back
    * @returns {Object or typeof str} an object if the input string can be parsed. If not, returns the str argument
    */
    optionalParse: (str) => {
        try{
            return JSON.parse(str);
        } catch(error){
            return str;
        }
    },
    /**
    * @description an async implementation of the forEach loop
    * @param {Array or Object} [iterable] something to iterate over (either array entries or object keys)
    * @param {Function} [callback] the async callback that will be executed on each iteration. Should accept at least one argument which will be either an array entry or an object's key value. The second argument is either the current index (a number) in the iterable array or the property name of the iterable object. The third argument is the iterable itself.
    */
    asyncForEach: async (iterable, callback) => {
        if (Array.isArray(iterable)){
            for (let index = 0; index < iterable.length; index++){
                await callback(iterable[index], index, iterable);
            }
        } else if (iterable instanceof Object){
            for (let prop in iterable){
                await callback(iterable[prop], prop, iterable);
            }
        }
    },
    /**
     * @description allows to wait asynchronously for the given number of milliseconds
     * @param {Number} [ms] the number of milliseconds to wait
     * @returns {Promise} a promise that will resolve after [ms] milliseconds
     */
    wait: (ms) => {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
};
