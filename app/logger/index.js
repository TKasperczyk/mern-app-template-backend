'use strict';

/**
 * Exposes two loggers: appLogger and httpLogger. The first one (appLogger) can be used to log formatted messages to the console. The second one (httpLogger) should be applied as middleware to express.
 *   appLogger expects two arguments:
 *       @param {String} [logMessage],
 *       @param {Object} [options]
 *   and the following options (all optional):
 *   {
 *       identifier: a string that identifies the callee
 *       meta: an object that will be stringified and appended to the log message
 *       logging: a boolean that indicates whether the given message should be logged
 *       callId: a string that identifies the async context (when there are multiple messages related to the same asynchronous operation)
 *   }
 */

const winston = require('winston');
const colors = require('colors');
const path = require('path');
require(`winston-daily-rotate-file`);
const config = require('../config');

const customLevels = {
    levels: {
        http: 8,
        api: 7,
        silly: 6,
        setup: 5,
        debug: 4,
        verbose: 3,
        info: 2,
        warn: 1,
        error: 0
    },
    colors: {
        http: 'italic grey',
        api: 'italic magenta',
        silly: 'grey',
        setup: 'white',
        debug: 'blue',
        verbose: 'cyan',
        info: 'green',
        warn: 'yellow',
        error: 'red'
    }
};


/**
 * @description creates a winston.format.printf that can be used in custom winston formatters. The produced printf creates standarized log messages based on their metadata (documented at the top)
 * @example
    Final format:
        timestamp - level {workerId}[identifier] callId: message | META: meta
    Example:
        2019-12-05T14:59:08.453Z - verbose {6}[router GET /api/radius/session/20142/?&limit=1] 46098828200327670: someone called getByClid  | META: {
            "query": {
                "limit": "1",
                "callback": "jQuery341022474529610221827_1575557609549",
                "data": "null",
                "_": "1575557610279"
            },
        }
 * @param {Boolean} [colorize = false] if true, the resulting message will include colors
 * @returns {typeof winston.format.printf} an instance of winston printf formatter
 */
const appPrintf = ({colorize = false}) => {
    return winston.format.printf((info) => {
        const metaObj = {};
        let metaString = ''; //This will hold the actual meta message - prettified and optionally truncated (based on config.logger.maxMetaLength)
        if (info.meta instanceof Object){ //Extract non-undefined values
            for (let key in info.meta){
                if (info.meta[key] !== undefined){
                    metaObj[key] = info.meta[key];
                }
                if (info.meta[key] instanceof Error){ //If there are any errors stored in the metadata, extract only the message
                    metaObj[key] = info.meta[key].message;
                }
            }
            metaString = config.logging.prettyMeta ? JSON.stringify(metaObj, null, 4) : JSON.stringify(metaObj);
        } else if (typeof info.meta === 'string'){ //Meta can also be a plain string
            metaString = info.meta;
        }
        //Truncate meta if it's longer than the config value
        if (typeof metaString === 'string' && config.logging.maxMetaLength < metaString.length){
            metaString = `Too long (${metaString.length} characters)`;
        }
        let identifier = info.identifier ? info.identifier : 'Unknown';
        //Ignore jQuery callback identifiers - extract only the meaningful part
        if (identifier && identifier.indexOf('callback=jQuery') > -1){
            identifier = info.identifier.substring(0, info.identifier.indexOf('callback=jQuery') - 1); //Also remove the '?' or '&' char
        }
        //Optionally colorize the identifier
        identifier = colorize ? colors.italic.bold.black(identifier) : identifier;
        const timestamp = info.timestamp;
        const level = info.level;
        const callId = info.callId ? ` ${colorize ? colors.italic.grey(info.callId) : info.callId}` : '';
        const message = info.message;
        let meta = '';
        //Optionally colorize metadata
        if (typeof metaString === 'string' && metaString.length > 0){
            meta = colorize ? colors.dim(`| META: ${metaString}`) : `| META: ${metaString}`;
        }
        const workerId = process.env.id !== undefined ? process.env.id : '';
        const workerIdColorized = colorize ? colors.bold.blue(workerId) : workerId;
        const finalMessage = `${timestamp} - ${level} {${workerIdColorized}}[${identifier}]${callId}: ${message} ${meta}`;
        return finalMessage;
    });
};

/**
 * @description creates a combined winston format - either colorized or not
 * @param {Boolean} [colorize = false] if true, the resulting formatter will use colors
 * @returns {typeof winston.format.combine} a combined winston formatter with our custom printf implementation
 */
const appFormatter = ({colorize = false}) => {
    if (colorize) {
        return winston.format.combine(
            winston.format.colorize(), //Colorize the log level
            appPrintf({colorize})
        );
    } else {
        return winston.format.combine(
            appPrintf({colorize})
        );
    }
};

const appLoggerTransports = [
    new (winston.transports.Console)({
        format: appFormatter({colorize: true}),
        name: 'appConsole',
        level: config.logging.level,
        handleExceptions: true,
        silent: process.env.NODE_ENV === 'test' ? true : false,
    }),
];

/**
 * Application console logger
 */

const appLogger = winston.createLogger({
    levels: customLevels.levels,
    format: winston.format.combine( //Add winston timestamp formatting and account for the "logging" option
        (winston.format((info, opts) => { //Don't log when logging is set to false
            for (let i = 0; i < appLogger.transports.length; i++){
                appLogger.transports[i].level = config.logging.level; //Update the logging level in case of configuration change
            }
            if (!info || info.logging === false){
                return false;
            } else {
                return info;
            }
        }))(),
        winston.format.timestamp()
    ),
    transports: appLoggerTransports,
    exitOnError: false,
});
winston.addColors(customLevels.colors);

/**
 * HTTP traffic logger
 * If we're testing, we don't want Winston's DailyRotateFile to interfere with the FS, therefore we assign an empty function in that case
 */
const httpLogger = process.env.NODE_ENV === 'test' ? {http: () => {}} : winston.createLogger({
    levels: customLevels.levels,
    transports: [
        new (winston.transports.DailyRotateFile)({
            filename: path.resolve(__dirname, '../../logs/http.log'),
            name: 'httpFile',
            datePattern: 'YYYY-MM-DD-HH',
            level: 'http',
            handleExceptions: true,
            prettyPrint: true,
            maxsize: '20M',
            maxFiles: '30d',
            silent: process.env.NODE_ENV === 'test' ? true : false,
        }),
    ],
    exitOnError: false,
});

httpLogger.stream = { //This will be used by Morgan
    write: (message, encoding) => {
        httpLogger.http(message);
    }
};

module.exports = {
    appLogger,
    httpLogger,
    __private: {
        appPrintf
    }
};
