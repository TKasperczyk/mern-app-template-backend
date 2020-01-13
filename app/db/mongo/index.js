'use strict';

/**
    Sets up the mongoDB connection
**/

const config = require('../../config');
const mongoose = require('mongoose');
const h = require('../../helpers');
const logger = require('../../logger').appLogger;

logger.info(`Connecting to ${config.db.mongo.url}`, {identifier: 'db mongo'});

mongoose.connect(config.db.mongo.url, {
    user: config.db.mongo.user,
    pass: config.db.mongo.password,
    auth: {
        authdb: config.db.mongo.authDb
    },
    connectTimeoutMS: 5000,
    //Get rid of depracation warnings
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    useFindAndModify: false
}).catch((error) => {
    logger.error(`Mongoose error: ${h.optionalStringify(error)}`, {identifier: 'db mongo'});
});

const connection = mongoose.connection;
connection.on('error', (error) => {
    logger.error(`Mongoose error: ${h.optionalStringify(error)}`, {identifier: 'db mongo'});
});

module.exports = {
    connection,
    mongoose,
    models: require('./models')(mongoose),
};
