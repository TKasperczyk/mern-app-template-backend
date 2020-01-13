[![Codacy Badge](https://api.codacy.com/project/badge/Grade/47663eb5b6024a9e9a29d80a4eb5b28f)](https://www.codacy.com/manual/Sarithis/mern-app-template?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=TKasperczyk/mern-app-template&amp;utm_campaign=Badge_Grade)

# MERN template for creating web applications

## Overview
This project is a boilerplate for sessionless web applications. It offers a set of modules and components that can be used for further development. It utilises the following technologies:
- [Redux](https://redux.js.org/)
- [Socket.io](https://socket.io/)
- [MongoDB](https://www.mongodb.com/) + [Mongoose](https://mongoosejs.com/)
- [Redis](https://redis.io/)
- [Express.js](https://expressjs.com/)
- [Passport.js](http://www.passportjs.org/)
- [Clustering](https://nodejs.org/api/cluster.html)

The template includes modules that allow for implementing access lists, model-based user permissions, JWT authentication and more. The backend works on multiple threads and automatically balances the load between nodes.

## Installation and starting up (Linux)
```bash
git clone https://github.com/TKasperczyk/mern-app-template
cd mern-app-template
./install.sh
./runDev.sh
```

## Backend modules
### acl
It uses `config/acl.json` to optionally protect backend routes. It's already hooked up to Express. Full documentation of this module can be found [here](https://github.com/nyambati/express-acl). The predefined access list is configured for two user roles: *user* and *admin*. Users can't use CRUD operations on `/api/user`. They can only access individual user records (`/api/user/*`), which are secured by the [permissions](https://github.com/TKasperczyk/mern-app-template#permissions) module.
### api
This module is a collection of functions that allow for modifying database objects and performing other API tasks. It utilises a set of generic functions that can be used for CRUD operations without code repetition. The module can be included anywhere in the application's backend. 
### auth
The auth module is responsible for registering Passport strategies, securing Socket.io connections and processing incoming requests. It allows for user registration, signing in by using standard credentials (login and password) and JWT tokens.
### config
Imports the configuration from `config/config.json`. Allows for reloading the config without restarting the application by adding the `_reload` method to its export values. 
### db
Exposes a connection to the database along with all mongoose models.
### helpers
A set of helper functions that aren't strictly related to any of the backend modules.
### logger
Exposes two logger instances: appLogger and httpLogger. The second one acts as a middleware and is hooked to express. appLogger allows to log messages to console with nice formatting, metadata and call IDs for tracting async operations.
### permissions
The permissions module allows for checking if a user is authorized to perform an action on a mongoose model. Its rules are defined in `config/permissions.json`. 
You can define custom checking functions in `app/permissions/permissionFunction.js`. 
The structure of `acl.json`:
```javascript
{
    /**
        VARIANT 1
        Name of the user's role
        @type: Object
    **/
    "admin": {
        /**
            Name of the mongoose model
            @type: String or Object
            If the value is a string, it must be an asterisk which indicates that every action is allowed 
            for the given role on this model
        **/
        "data.user": "*"
    },
    /**
        VARIANT 2
    **/
    "user": {
        "data.user": {
            /**
                Name of the CRUD action that will be performed on the model: add, get, update, delete
                @type: Boolean or String
                If the value is boolean, you either allow or disallow the user role to perform the given 
                action on `data.user`. 
                If you want a custom check with your own logic, you can use the string: "function". 
                In this case, you need to define the corresponding function in 
                `app/permissions/permissionFunctions.js`
            **/
            "add": false,
            "get": "function",
            "update": "function",
            "delete": "function"
        }
    }
}
```
The structure of `app/permissions/permissionFunction.js`:
```javascript
module.exports = {
    /**
        Name of the user's role
        @type: Object
    **/
    user: {
        /**
            Name of the mongoose model
            @type: Object
        **/
        'data.user': {
            /**
                Name of the CRUD action that will be performed on the model: add, get, update, delete
                @type: Function
                `data` can be anything you want - you pass it in the last optional argument to the 
                `permissions` function.
                `user` should be the user object extracted from a request
            **/
            get: (data, user) => {
                return data.id == user._id;
            },
            update: (data, user) => {
                return data.id == user._id;
            },
            delete: (data, user) => {
                return data.id == user._id;
            }
        }
    }
};
```
### roomManager
This module isn't used anywhere in the template by default. It should be used to synchronize Socket.io rooms between threads. To achieve this, roomManager uses Redis as a common data store. Example usage:
```javascript
const manager = new RoomManager(1); "1" is the redis database identifier
manager.init().then(() => {
    //Everything related to socket.io should be done after the manager initialization
    io.of('/someNamespace').on('connection', (socket) => {
        io.of('/someNamespace').adapter.remoteJoin(socket.id, 'roomName', async (error) => {
            //It automatically creates a room if it doesn't exist
            await manager.addClient('someNamespace', 'roomName', socket.id);
        });
    });
});
```
### router
Every route is defined in this module. New routes should be added to `module.exports`. They are secured by JWT, [acl](https://github.com/TKasperczyk/mern-app-template#acl) and [permissions](https://github.com/TKasperczyk/mern-app-template#permissions). Every API function should be called through `performApiCall`. Errors can be handled by `handleError`. Example:
```javascript
'patch': {
    '/api/user/:id': (req, res) => {
        //We're checking if req.body contains the key: 'user'
        if (!h.checkMandatoryArgs({argMap: { user: true }, args: req.body})){
            return handleError(req, res, 'Incorrect or incomplete arguments');
        }
        //The last argument (the object) is passed to your custom permission validating 
        //function defined in app/permissions/permissionFunction.js
        if (!permissions(
            req.user.role, 
            'data.user', 
            'update', 
            {data: {id: req.params.id}, user: req.user})
        ){
            return handleError(req, res, 'You don\'t have sufficient permissions to perform this action');
        }
        //The args parameter is destructured and passed to api.user.update 
        performApiCall({
            req, 
            res, 
            apiFunc: api.user.update, 
            args: { id: req.params.id, user: req.body.user }
        });
    },
},
```
### scheduler
Allows for creating cron-like tasks that are executed periodically according to the configuration. Full documentation can be found [here](https://github.com/node-schedule). An example configuration is included in `config/config.sample.json`. New workers should be defined in the main `workers` object inside the module. It's important to account for the `currentlyRunning` flag as shown in the example. If the task is about to be executed while the worker function from the previous execution is still running, the current execution is canceled. 
### socket
Handles socket.io connections. In order to utilise the rooms functionality, you should use [roomManager](https://github.com/TKasperczyk/mern-app-template#roomManager) to keep them in sync. 