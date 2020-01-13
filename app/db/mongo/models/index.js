'use strict';

/**
    Scans the current directory and loads all model files
    File names should be the same as model names. Models can be grouped into categories with an optional dot-separated name prefix, e.g.: data.user.js, cache.notification.js, cache.tempFile.js etc.
**/

//Using graceful-fs to limit the amount of open file descriptors
const fs = require('graceful-fs');

module.exports = (mongoose) => {
    const allModels = {};
    fs.readdirSync(__dirname).forEach(function(file) {
        if (file !== 'index.js') {
            const fileName = file.match(/.+(?=\.js)/)[0];
            allModels[fileName] = require('./' + fileName)(mongoose);
        }
    });

    return allModels;
};
