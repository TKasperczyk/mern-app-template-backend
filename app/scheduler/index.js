'use strict';

/**
    Manages a periodic function execution.
    Can be used to send scheduled events, perform database cleanups, reload the configuration periodically etc.
**/

const schedule = require(`node-schedule`);
const config = require(`../config`);
const h = require(`../helpers`);
const logger = require(`../logger`).appLogger;

const workers = {
    example: {
        worker: async (nextExecutionDate) => {
            const callId = h.generateCallId();
            try{
                workers.example.currentlyRunning = true;
                logger.info('Starting periodic example', {identifier: 'scheduler cacheRotate example', logging: config.scheduler.example.logging.state, callId});
                //...
                workers.example.currentlyRunning = false;
            } catch(error){
                logger.error('An error occured while running example', {identifier: 'scheduler example', meta: {error}, callId});
                workers.example.currentlyRunning = false;
            }
        },
        currentlyRunning: false
    },
};

module.exports = () => {
    return {
        example: schedule.scheduleJob(config.scheduler.example.cronTime, async function() {
            if (config.scheduler.example.enabled === false){
                return;
            }
            if (workers.example.currentlyRunning === true){
                logger.warn('The worker function for example is overlapping. Canceling the current attempt of execution. Try extending config.scheduler.example.cronTime', {identifier: 'scheduler example'});
                return;
            }
            return await workers.example.worker(this.nextInvocation());
        }),
    };
};