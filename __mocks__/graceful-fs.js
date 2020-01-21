'use strict';

const path = require('path');
const fs = jest.genMockFromModule('graceful-fs');

// This is a custom function that our tests can use during setup to specify
// what the files on the "mock" filesystem should look like when any of the
// `fs` APIs are used.
let mockFiles = {};

const __setMockFiles = (newMockFiles, {resetOld = true} = {resetOld: true}) => {
    if (resetOld){
        mockFiles = {};
    }
    for (const filePath in newMockFiles){
        const resolvedPath = path.resolve(__dirname, filePath);
        mockFiles[resolvedPath] = newMockFiles[filePath];
    }
};

// A custom version of `readFileSync` that reads from the special mocked out
// file list set via __setMockFiles
const readFileSync = (directoryPath) => {
    return mockFiles[directoryPath];
};

const existsSync = (directoryPath) => {
    return mockFiles[directoryPath] !== undefined;
};

fs.__setMockFiles = __setMockFiles;
fs.readFileSync = readFileSync;
fs.existsSync = existsSync;
fs.readdirSync = jest.requireActual('graceful-fs').readdirSync;

module.exports = fs;
