'use strict';

module.exports = (workerId, callback) => {
    process.env.id = workerId;

    const express = require('express');
    const passport = require('passport');
    const morgan = require('morgan');
    const helmet = require('helmet');
    const backend = require('./app');
    const app = express();

    /* Middleware */
    app.use(helmet()); //For security
    if (!backend.config.logging.disableHttp){
        app.use(morgan('combined', {stream: backend.logger.httpLogger.stream}));
    }
    app.use(express.json({}));
    app.use(express.urlencoded({extended: true}));

    /* Backend middleware */
    app.use(passport.initialize());
    app.use('/', backend.router);

    //If the first worker should run on a separate port: backend.helpers.isMasterWorker() ? backend.config.server.mainPort : backend.config.server.clusterPort;
    const port = backend.config.server.port;
    const bundle = backend.getServerBundle(app);
    bundle.httpServer.listen(port, () => {
        backend.logger.appLogger.info(`Running on TCP ${port}`, {identifier: 'server'});
        if (typeof callback === 'function'){
            callback();
        }
    });
    return {
        app,
        backend,
        bundle
    };
};

//We're able to start only one instance
if (require.main === module){
    module.exports(1);
}
