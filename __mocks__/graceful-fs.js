'use strict';

/**
 * It's used in our tests to mask some graceful-fs functions and leave others intact.
 * Allows for loading a custom configuration, permissions, ACL rules etc.
 * Exposes a function "__setMockFiles" that allows for setting a list of file paths along with their contents
 * The files will be used by the masked functions
 */

const path = require('path');
// ! Every function in this module is mocked by the generator. If we want to use an actual FS function (non-masked), we need to export it manually by jest.requireActual
const mockedFs = jest.genMockFromModule('graceful-fs');
const actualFs = jest.requireActual('graceful-fs');

//Will hold all the mocked files used by the masked FS functions
let mockFiles = {};

/**
 * @description sets a list of mock files that will be used by the masked functions
 * @param {Object}  [newMockFiles] an object with mock files where keys are the paths and values are the contents
 * @param {Boolean} [resetOld = true] if set to false, the global mockFiles object won't be erased before assigning new files. Useful for upserting
 */
const __setMockFiles = (newMockFiles, {resetOld = true} = {}) => {
    if (resetOld){
        mockFiles = {};
    }
    for (const filePath in newMockFiles){
        const resolvedPath = path.resolve(__dirname, filePath);
        mockFiles[resolvedPath] = newMockFiles[filePath];
    }
};

/**
 * @description a custom implementation of the fs.readFileSync function that uses an arbitrary set of files saved in the global mockFiles object which is controlled by __setMockFiles
 * @param {String} [path] the path to the requested directory or file
 * @returns {String} returns the previously set contents of the requested file
 */
const readFileSync = (path) => {
    return mockFiles[path];
};

/**
 * @description a custom implementation of the fs.readFileSync function that uses an arbitrary set of files saved in the global mockFiles object which is controlled by __setMockFiles
 * @param {String} [path] the path to the requested directory or file
 * @returns {Boolean} true if the file path was previously set by __setMockFiles function in the global mockFiles object
 */
const existsSync = (path) => {
    return mockFiles[path] !== undefined;
};

// * Overwrite the mocked functions with our masked functions
mockedFs.__setMockFiles = __setMockFiles;
mockedFs.readFileSync = readFileSync;
mockedFs.existsSync = existsSync;
// * Add all the functions that will be used but won't be masked
mockedFs.readdirSync = actualFs.readdirSync;

module.exports = mockedFs;
