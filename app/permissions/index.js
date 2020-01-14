'use strict';

/**
    Allows to check if the given user (defined by his role) is allowed to perform the given action on the given model
    The structure of /config/permissions.json:
    {
        <roleName>: {
            <mongooseModelName>: {
                <actionName>: <permission>,
            }
        }
    }
    <roleName> - should correspond to the user's role
    <mongooseModelName> - the model must be defined in mongoose prior to this module's initialization
    <actionName> - supported action names: "get", "update", "delete", "add"
    <permission> - either a boolean indicating whether the user has the permission, or "function" indicating that there's a custom checking function defined in /app/permissions/permissionFunctions.js
**/

//Using graceful-fs to limit the amount of open file descriptors
const fs = require('graceful-fs');
const dotObj = require('dot-object');
const path = require('path');
const h = require('../helpers');
const db = require('../db').mongo.models;
//This will be overwritten in unit tests, therefore it can't be const
let permissionFunctions = require('./permissionFunctions');
const logger = require('../logger').appLogger;

/**
    Loads the permissions.json file into the global `permissions` variable
**/
//These could be const, but will be changed in tests
let permissions = null;
let permissionsPath = path.resolve(__dirname, '../../config/permissions.json');
const loadPermissionsJson = () => {
    if (fs.existsSync(permissionsPath)){
        try{
            permissions = JSON.parse(fs.readFileSync(permissionsPath, 'utf8'));
        } catch(error){
            throw(`Error while parsing the permissions.json file: ${h.optionalStringify(error)}`);
        }
    } else {
        throw('Error: /config/permissions.json not found');
    }
};

/**
    Validates the structure of permissions.json and permissionFunctions.js.
    Throws an error if there's something wrong with the structure
**/
const validatePermissions = () => {
    //Some models have dots in their names, so we can't use the default dot
    const picker = new dotObj('->');
    try{
        for (let roleName in permissions){
            const rolePermissions = permissions[roleName];
            if (typeof rolePermissions !== 'object'){
                throw(`permissions.${roleName} isn't an object`);
            }
            for (let modelName in rolePermissions){
                const modelPermissions = rolePermissions[modelName];
                if (!db[modelName]){
                    throw(`There's no model called ${modelName} defined in mongoose`);
                }
                if (typeof modelPermissions === 'string'){
                    if (modelPermissions !== '*'){
                        throw(`Unknown value for permissions.[${roleName}][${modelName}]. Supported values: "*", object`);
                    } else {
                        continue;
                    }
                }
                for (let actionName in modelPermissions){
                    const actionPermission = modelPermissions[actionName];
                    if (!['get', 'update', 'delete', 'add'].includes(actionName)){
                        throw(`Unknown action name for permissions[${roleName}][${modelName}]: ${actionName}. Supported actions: add, get, update, delete`);
                    }
                    if (typeof actionPermission === 'string'){
                        if (actionPermission !== 'function'){
                            throw(`Unknown value for permissions[${roleName}][${modelName}][${actionName}] Supported values: "function", boolean`);
                        } else {
                            if (typeof picker.pick(`${roleName}->${modelName}->${actionName}`, permissionFunctions) !== 'function'){
                                throw (`There's no function defined for permissions[${roleName}][${modelName}][${actionName}]. Go to /app/permissions/permissionFunctions.js and define it`);
                            }
                        }
                    } else if (typeof actionPermission !== 'boolean'){
                        throw(`Unknown value type for permissions[${roleName}][${modelName}][${actionName}]. Supported values: "function", boolean`);
                    }
                }
            }
        }
    } catch(error){
        throw(`Permission parsing error: ${h.optionalStringify(error)}`);
    }
};

loadPermissionsJson();
validatePermissions();

module.exports = (roleName, modelName, actionName, {data = null, user = null} = {}) => {
    const dotter = new dotObj('->');
    const modelPermissions = dotter.pick(`${roleName}->${modelName}`, permissions);
    //Check if there are any permissions defined for the given role and model
    if (!modelPermissions){
        logger.error(`There's no permissions defined for role: ${roleName}, model: ${modelName}`);
        return false;
    }
    //Check if there are wildcard permissions for the given role and model
    if (modelPermissions === '*'){
        return true;
    }
    //If there are no wildcard permissions, check the modelPermissions' actions
    const actionPermission = dotter.pick(`${roleName}->${modelName}->${actionName}`, permissions);
    //Check if there are any permissions for the given action
    if (typeof actionPermission !== 'string' && typeof actionPermission !== 'boolean'){
        logger.error(`There's no permission defined for role: ${roleName}, model: ${modelName}, action: ${actionName}`);
        return false;
    }
    //If there's a custom permission function defined, return its result
    if (actionPermission === 'function'){
        return permissionFunctions[roleName][modelName][actionName](data, user);
    } else {
        //Otherwise return the given permission - it must be boolean
        return actionPermission;
    }
};