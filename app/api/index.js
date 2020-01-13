'use strict';

/**
    This module exposes the API of this app. It *DOES NOT* check user authentication, authorization and permissions - these are done in the router module.
**/

const dotObj = require('dot-object');
const h = require('../helpers');
const logger = require('../logger').appLogger;
const mongoDb = require('../db').mongo.models;


/*
    A set of generic CRUD functions that can be applied to multiple different models.
    It was created to avoid copy-pasting the same code for every DB object
*/
const generics = {
    /*
        Creates a new object in the database.
        Calls the mongoDb.models[modelName] constructor and passes the input object as the argument.
        The modifierFunc parameter is optional. It's a custom function that receives the newly created object as an argument. The function can modify it before it gets saved in the database. The modifier should return the modified object.
        logPathPrefix is optional - it should be a string which will be prepended to the identifier in log messages. It's useful when the the modelName is ambiguous.
    */
    add: async ({inputObj, modelName, modifierFunc = null, logPathPrefix = '', logging = true, callId = null}) => {
        callId = h.generateCallId(callId);
        logger.api(`Adding a new ${modelName}`, {logging, identifier: `api ${logPathPrefix}${modelName} add`, meta: {inputObj}, callId});
        try{
            if (inputObj === undefined || typeof inputObj !== 'object'){
                throw('Wrong inputObj argument');
            }
            logger.api(`Creating a new ${modelName}`, {logging, identifier: `api ${logPathPrefix}${modelName} add`, callId});
            let newObj = new mongoDb[modelName](inputObj);
            if (typeof modifierFunc === 'function'){
                newObj = modifierFunc(newObj);
            }
            logger.api(`Saving the new ${modelName}`, {logging, identifier: `api ${logPathPrefix}${modelName} add`, callId});
            const savedObj = await newObj.save();
            if (savedObj){
                logger.api(`Successfully added a new ${modelName}`, {logging, identifier: `api ${logPathPrefix}${modelName} add`, meta: {savedObj}, callId});
                return mongoDb[modelName].findOne(savedObj._id); //For autopopopulate to work
            } else {
                throw(`Failed to add a new ${logPathPrefix}${modelName}: unknown error`);
            }
        } catch (error){
            logger.error(`Failed to add a new ${modelName}: ${h.optionalStringify(error)}`, {identifier: `api ${logPathPrefix}${modelName} add`, meta: {inputObj}, callId});
            throw error;
        }
    },
    /*
        Deletes an object from the database
        The id argument should be a string representing an ObjectId.
    */
    delete: async ({id, modelName, logPathPrefix = '', logging = true, callId = null}) => {
        callId = h.generateCallId(callId);
        logger.api(`Deleting a ${modelName}`, {logging, identifier: `api ${logPathPrefix}${modelName} delete`, meta: {id}, callId});
        try{
            if (id === undefined || typeof id !== 'string' || !(/^[a-fA-F0-9]{24}$/).test(id)){
                throw('Wrong id argument');
            }
            const deletedObj = await mongoDb[modelName].findByIdAndRemove(id).exec();
            if (deletedObj){
                logger.api(`Successfully deleted a ${modelName} with an id: ${id}`, {logging, identifier: `api ${logPathPrefix}${modelName} delete`, meta: {deletedObj}, callId});
                return deletedObj;
            } else {
                throw(`Failed to delete ${modelName} with id: ${id}`);
            }
        } catch (error){
            logger.error(`Failed to delete an existing ${modelName}: ${h.optionalStringify(error)}`, {identifier: `api ${logPathPrefix}${modelName} delete`, meta: {id}, callId});
            throw error;
        }
    },
    /*
        Updates an object in the database.
        Passes inputObj to findByIdAndUpdate function.
        The modifierFunc parameter is optional. It's a custom function that receives the newly created object as an argument. The function can modify it before it gets saved in the database. The modifier should return the modified object.
        The id argument should be a string representing an ObjectId.
    */
    update: async ({id, inputObj, modelName, modifierFunc, logPathPrefix = '', logging = true, callId = null}) => {
        callId = h.generateCallId(callId);
        logger.api(`Updating a ${modelName}`, {logging, identifier: `api ${logPathPrefix}${modelName} update`, meta: {id, inputObj}, callId});
        try{
            if (id === undefined || typeof id !== 'string' || !(/^[a-fA-F0-9]{24}$/).test(id)){
                throw(`Wrong id argument: ${id === undefined ? `undefined` : id} ${typeof id} ${typeof id === `string` ? !(/^[a-fA-F0-9]{24}$/).test(id) : 'regex not applicable'}`);
            }
            if (inputObj === undefined || typeof inputObj !== 'object'){
                throw(`Wrong ${modelName} argument`);
            }
            if (typeof modifierFunc === 'function'){
                inputObj = modifierFunc(inputObj);
            }
            inputObj = dotObj.dot(inputObj);
            const updateResult = await mongoDb[modelName].updateOne({_id: id}, {$set: inputObj}, {new: false});
            if (updateResult.ok){
                logger.api(`Successfully updated a ${modelName} with an id: ${id}`, {logging, identifier: `api ${logPathPrefix}${modelName} update`, meta: {updateResult}, callId});
                return await mongoDb[modelName].findById(id);
            } else {
                throw(`Failed to update ${modelName} with id: ${id}`);
            }
        } catch (error){
            logger.error(`Failed to update an existing ${modelName}: ${h.optionalStringify(error)}`, {identifier: `api ${logPathPrefix}${modelName} update`, meta: {id, inputObj}, callId});
            throw error;
        }
    },
    /*
        Gets an object from the database.
        The id argument should be a string representing an ObjectId.
    */
    get: async ({id, modelName, logPathPrefix = '', logging = true, callId = null}) => {
        callId = h.generateCallId(callId);
        logger.api(`Getting ${modelName}`, {logging, identifier: `api ${logPathPrefix}${modelName} get`, meta: {id}, callId});
        try{
            let result = null;
            if (id === undefined){
                result = await mongoDb[modelName].find({}).lean({autopopulate: true});
            } else {
                result = await mongoDb[modelName].findById(id).lean({autopopulate: true});
            }

            if ((result instanceof Array && result.length === 0) || result === null || result === undefined){
                logger.api(`Returning 0 ${modelName}s`, {logging, identifier: `api ${logPathPrefix}${modelName} get`, meta: {id}, callId});
                return [];
            }
            logger.api(`Returning ${result instanceof Array ? result.length : 1} ${modelName}s`, {logging, identifier: `api ${logPathPrefix}${modelName} get`, meta: {id, result}, callId});
            return result;
        } catch (error){
            logger.error(`Failed to get an existing ${modelName}: ${h.optionalStringify(error)}`, {identifier: `api ${logPathPrefix}${modelName} get`, meta: {id}, callId});
            throw error;
        }
    }
};

/**
    The actual functions
**/

module.exports = {
    user: {
        add: async ({user, logging = true, callId = null}) => {
            return await generics.add({
                inputObj: user,
                modelName: 'data.user',
                logPathPrefix: 'user ',
                logging,
                callId
            });
        },
        delete: async ({id, logging = true, callId = null}) => {
            return await generics.delete({
                id,
                modelName: 'data.user',
                logPathPrefix: 'user ',
                logging,
                callId
            });
        },
        update: async ({id, user, logging = true, callId = null}) => {
            return await generics.update({
                id,
                inputObj: user,
                modelName: 'data.user',
                logPathPrefix: 'user ',
                logging,
                callId
            });
        },
        get: async ({id, logging = true, callId = null} = {}) => {
            return await generics.get({
                id,
                modelName: 'data.user',
                logPathPrefix: 'user ',
                logging,
                callId
            });
        },
    },
};

//recurse();
