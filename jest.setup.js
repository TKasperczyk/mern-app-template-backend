const testH = require('./tests/helpers');

//Disable logger
process.env.NODE_ENV = 'test';

//Bypass config files
testH.fn.resetAll({setupConfig: true});