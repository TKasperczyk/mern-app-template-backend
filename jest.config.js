const appRoot = require('app-root-path');

module.exports = {
    testEnvironment: 'node', //For mongoose
    setupFiles: [`${appRoot}/jest.setup.js`],
    collectCoverageFrom: [
        '**/*.js',
        '!data/keyMap.js',
        '!/node_modules/',
    ]
};