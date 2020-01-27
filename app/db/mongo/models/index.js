'use strict';

/**
 * Scans the current directory and loads all model files. Exposes them in the module exports
 * File names should be the same as model names. Models can be grouped into categories with an optional dot-separated name prefix, e.g.: data.user.js cache.notification.js, cache.tempFile.js etc.
 */

//Using graceful-fs to limit the amount of open file descriptors
const fs = require('graceful-fs');

/**
 * @description searches for all the files in the current directory excluding itself. Requires each file and exposes it in the exports
 * @param {Object} [mongoose] the already configured mongoose module
 * @returns {Object} an object with keys representing the file (model) names
 */
module.exports = (mongoose) => {
    //This will be returned
    const allModels = {};
    //Scan the current directory and search for files
    fs.readdirSync(__dirname).forEach(function(file) {
        //Ignore the index file (this file)
        if (file !== 'index.js') {
            //Remove the extension from the found file name so it can be used as a mongoose model name
            const fileName = file.match(/.+(?=\.js)/)[0];
            //Require the found file (require doesn't need the extension) and assign it to the returned object. The file should return a mongoose model
            allModels[fileName] = require('./' + fileName)(mongoose);
        }
    });

    return allModels;
};
