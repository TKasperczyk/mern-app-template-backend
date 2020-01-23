'use strict';

/**
 * Imports the configuration from /config/config.json.
 * The config will be exported along with the _reload function that allows to reload the configuration without "re-requiring" the module or restarting the app
 */

//Using graceful-fs to limit the amount of open file descriptors
const fs = require('graceful-fs');
const path = require('path');
const h = require('../helpers');

const configPath = path.resolve(__dirname, '../../config/config.json');
//The config can be reloaded, therefore it's not const
let configJson = null;

/**
 * @description checks if the config file exists. If so, reads its contents and parses it as a JS object
 * @throw {Error} will throw if the config file doesn't exist or it's not parsable
 */
const loadConfig = () => {
    if (fs.existsSync(configPath)){
        try{
            configJson = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            Object.assign(module.exports, configJson);
        } catch(error){
            throw new Error(`Error while parsing the config.json file: ${h.optionalStringify(error)}`);
        }
    } else {
        throw new Error('Error: /config/config.json not found');
    }
};

loadConfig();
Object.assign(module.exports, {
    _reload: loadConfig
});
