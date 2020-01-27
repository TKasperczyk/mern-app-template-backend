'use strict';

/**
 * Sets up the connection with MongoDB, exposes all the models 
 */

const config = require('../../config');
const mongoose = require('mongoose');
const h = require('../../helpers');
const logger = require('../../logger').appLogger;

logger.info(`Connecting to ${config.db.mongo.url}`, {identifier: 'db mongo'});

const connectionOptions = {
    connectTimeoutMS: 5000,
    //Get rid of depracation warnings
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    useFindAndModify: false
};

/**
 * @description creates an object with mongoose auth options based on the configuration
 * @returns {Object} either an empty object or an object with database credentials (depends on config.db.mongo.auth). The resulting object can be passed to mongoose.connect
 */
const generateAuthOptions = () => {
    let authOptions = {};
    //Make sure we don't use auth options when connecting if config.db.mongo.auth isn't true
    if (config.db.mongo.auth === true){
        authOptions = {
            user: config.db.mongo.user,
            pass: config.db.mongo.password,
            auth: {
                authdb: config.db.mongo.authDb
            },
        };
    }
    return authOptions;
};

//Merge possible auth options with the predefined connection options
const mongoOptions = Object.assign({}, connectionOptions, generateAuthOptions());
//Connect to the database with the merged options
mongoose.connect(config.db.mongo.url, mongoOptions).catch((error) => {
    logger.error(`Mongoose error: ${h.optionalStringify(error)}`, {identifier: 'db mongo'});
});

//Extract the connection for easier access in module.exports
const connection = mongoose.connection;
connection.on('error', (error) => {
    logger.error(`Mongoose error: ${h.optionalStringify(error)}`, {identifier: 'db mongo'});
});

module.exports = {
    connection,
    mongoose,
    models: require('./models')(mongoose), //Load all the models from the ./models directory
    __private: { //For tests
        generateAuthOptions,
        connectionOptions
    }
};
