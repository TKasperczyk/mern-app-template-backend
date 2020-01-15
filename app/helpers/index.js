'use strict';

/**
    Provides helper functions used across the whole project
**/

const bCrypt = require('bcrypt-nodejs');
const jwt = require('jsonwebtoken');
const config = require('../config');

module.exports = {
    /**
        We're assuming that the main worker will have an env id of "1" - the ids are assigned in the main entry file (cluster.js). 
        Returns true if the current process is the main (first) worker
    **/
    isMasterWorker: () => {
        return process.env.id == '1';
    },
    /*
        Generates a response which is returned to the client.
        If an argument is undefined, it's replaced with a null
    */
    generateResponse: (status, data, error) => {
        return{
            status: status !== undefined ? status : null,
            data: data !== undefined ? data : null,
            error: error !== undefined ? error : null
        };
    },
    generateJwt: (userObj) => {
        return jwt.sign(userObj, config.jwtKey, {expiresIn: '24h'});
    },
    /**
        argMap should be an object with key names representing argument names. Every property that should be checked must be defined (the value doesn't matter).
        If the property contains a function, it will be executed and its output (should be boolean) will be taken into account instead.
        Example:
            argMap: {
                ip: true, //Check if exists (any value)
                routerId: (routerId) => { //Function check
                    return routerId > 0 && routerId < 16
                }
            }
            args: {
                ip: "1.2.3.4",
                routerId: -1
            }
        Result: it will return false because the "onu" argument doesn't meet the argMap requiremenets
    **/
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
        Generates a random number that can be used to identify async calls in the logger module
    **/
    generateCallId: (currentCallId) => {
        return currentCallId === undefined || currentCallId === null ? Math.floor(Math.random() * Math.pow(10, 17)) : currentCallId;
    },
    /**
        Generates a password hash from the provided cleartext password
    **/
    generateHash: (password, rounds = 12) => {
        return bCrypt.hashSync(password, bCrypt.genSaltSync(rounds), null);
    },
    /**
		Returns true if the provided password is correct. The first argument should be a user object from the database
	**/
    isValidPassword: (user, password) => {
        return bCrypt.compareSync(password, user.password);
    },
    /**
        Returns a stringied version of the argument only if it's an actual object with at least one key. Otherwise, returns the original argument
    **/
    optionalStringify: (obj) => {
        if (obj instanceof Object && (Object.keys(obj)).length > 0){
            return JSON.stringify(obj, null, 4);
        } else {
            return obj;
        }
    },
    /**
        Returns an object if the input string can be parsed. If not, returns it raw
    **/
    optionalParse: (obj) => {
        try{
            return JSON.parse(obj);
        } catch(error){
            return obj;
        }
    },
    /**
        Allows to use await in the forEach callback
    **/
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
        Return a promise after ms number of milliseconds
    **/
    wait: (ms) => {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
};
