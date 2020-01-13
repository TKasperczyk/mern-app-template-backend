const path = require('path');

module.exports = {
    testEnvironment: 'node', //For mongoose
    setupFiles: [path.resolve(__dirname, './jest.setup.js')],
    collectCoverageFrom: [
        '**/*.js',
        '!data/keyMap.js',
        '!/node_modules/',
        '!jest.config.js',
        '!jest.setup.js'
    ]
};