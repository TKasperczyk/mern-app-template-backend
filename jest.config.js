const path = require('path');

module.exports = {
    testEnvironment: 'node', //For mongoose
    setupFilesAfterEnv: [path.resolve(__dirname, './jest.setup.js')],
    collectCoverageFrom: [
        '**/*.js',
        '!**/node_modules/**',
        '!<rootDir>/jest.config.js',
        '!<rootDir>/jest.setup.js',
        '!<rootDir>/tests/**',
        '!<rootDir>/coverage/**',
        '!<rootDir>/cluster.js' //We can't really test the cluster
    ],
};