'use strict';

/**
    Imports configuration from /config/config.json file
    The config will be exported along with the _reload function that allows to reload the configuration without "re-requiring" the module or restarting the daemon
**/

//Using graceful-fs to limit the amount of open file descriptors
const fs = require('graceful-fs');
const path = require('path');
const h = require('../helpers');

const configPath = path.resolve(__dirname, '../../config/config.json');
//The config can be reloaded, therefore it's not const
let configJson = null;

/**
    Loads the config.json file to the configJson variable
**/
const loadConfig = () => {
    if (fs.existsSync(configPath)){
        try{
            configJson = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch(error){
            throw(`Error while parsing the config.json file: ${h.optionalStringify(error)}`);
        }
    } else {
        throw('Error: /config/config.json not found');
    }
    Object.assign(module.exports, configJson);
};

loadConfig();
Object.assign(module.exports, {
    _reload: loadConfig
});
