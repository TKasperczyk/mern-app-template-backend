'use strict';

const cluster = require('cluster');
const cpus = require('os').cpus();
const logger = require('./app/logger').appLogger;

if (cluster.isMaster){
    process.env.id = 'MASTER';
    logger.info(`Master ${process.pid} is running`, {identifier: 'cluster'});
    // Fork workers.
    for (let cpu of cpus){ // eslint-disable-line no-unused-vars
        cluster.fork();
    }
    cluster.on('exit', (worker, code, signal) => {
        logger.error(`Worker ${worker.process.pid} died`, {identifier: 'cluster'});
    });
} else if (cluster.isWorker){
    require('./server.js')(cluster.worker.id);
}

module.exports = cluster;