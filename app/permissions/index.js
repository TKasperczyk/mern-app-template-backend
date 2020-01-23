'use strict';

/**
 * Allows to check if the given user (defined by his role) is allowed to perform the given action on the given model.
 * Full description with details: https://github.com/TKasperczyk/mern-app-template#permissions
 * You need to call the init method (once) before doing any checks
 * The structure of /config/permissions.json:
 * {
 *     <roleName>: {
 *         <mongooseModelName>: {
 *             <actionName>: <permission>,
 *         }
 *     }
 * }
 * <roleName> - should correspond to the user's role
 * <mongooseModelName> - the model must be defined in mongoose prior to this module's initialization
 * <actionName> - supported action names: "get", "update", "delete", "add"
 * <permission> - either a boolean indicating whether the user has the permission, or "function" indicating that there's a custom checking function defined in /app/permissions/permissionFunctions.js
 */

//Using graceful-fs to limit the amount of open file descriptors
const fs = require('graceful-fs');
const dotObj = require('dot-object');
const path = require('path');
const h = require('../helpers');
const db = require('../db').mongo.models;
const permissionFunctions = require('./permissionFunctions');
const logger = require('../logger').appLogger;

/**
 * @description loads the permissions.json file into the global `permissions` variable
 * @param {String} [permissionsPath] full path to the permissions.json file
 * @throws {Error} if the permissions.json file is not found or not parsable
 */
const getPermissionsJson = (permissionsPath) => {
    if (fs.existsSync(permissionsPath)){
        try{
            return JSON.parse(fs.readFileSync(permissionsPath, 'utf8'));
        } catch(error){
            throw new Error(`Error while parsing the permissions.json file: ${h.optionalStringify(error)}`);
        }
    } else {
        throw new Error('Error: /config/permissions.json not found');
    }
};

/**
 * @description checks if the data in permissionsJson and permissionFunctions are compliant to our rules and standards
 * @param {Object} [permissionsJson] a parsed permissions.json file - the result of getPermissionsJson
 * @param {Object} [permissionFunctions] a list of functions with custom checks - the result of requiring ./permissionFunctions.js
 * @throws {Error} if the structure of permissionsJson or permissionsFunctions is wrong
 */
const validatePermissions = (permissionsJson, permissionFunctions) => {
    //Some models have dots in their names, so we can't use the default dot
    const picker = new dotObj('->');
    try{
        for (let roleName in permissionsJson){
            const rolePermissions = permissionsJson[roleName];
            if (typeof rolePermissions !== 'object'){
                throw new Error(`permissions.${roleName} isn't an object`);
            }
            for (let modelName in rolePermissions){
                const modelPermissions = rolePermissions[modelName];
                if (!db[modelName]){
                    throw new Error(`There's no model called ${modelName} defined in mongoose`);
                }
                if (typeof modelPermissions === 'string'){
                    if (modelPermissions !== '*'){
                        throw new Error(`Unknown value for permissions.[${roleName}][${modelName}]. Supported values: "*", object`);
                    } else {
                        continue;
                    }
                }
                for (let actionName in modelPermissions){
                    const actionPermission = modelPermissions[actionName];
                    if (!['get', 'update', 'delete', 'add'].includes(actionName)){
                        throw new Error(`Unknown action name for permissions[${roleName}][${modelName}]: ${actionName}. Supported actions: add, get, update, delete`);
                    }
                    if (typeof actionPermission === 'string'){
                        if (actionPermission !== 'function'){
                            throw new Error(`Unknown value for permissions[${roleName}][${modelName}][${actionName}] Supported values: "function", boolean`);
                        } else {
                            if (typeof picker.pick(`${roleName}->${modelName}->${actionName}`, permissionFunctions) !== 'function'){
                                throw new Error(`There's no function defined for permissions[${roleName}][${modelName}][${actionName}]. Go to /app/permissions/permissionFunctions.js and define it`);
                            }
                        }
                    } else if (typeof actionPermission !== 'boolean'){
                        throw new Error(`Unknown value type for permissions[${roleName}][${modelName}][${actionName}]. Supported values: "function", boolean`);
                    }
                }
            }
        }
    } catch(error){
        throw new Error(`Permission parsing error: ${h.optionalStringify(error)}`);
    }
};

module.exports = {
    /**
     * @description checks if the given role can perform the given action on the given model. The init function needs to be called before using this one
     * @param {String} [roleName] user's role name
     * @param {String} [modelName] mongoose model name
     * @param {String} [actionName ]one of: "get", "update", "delete", "add"
     * @param {*} [data = null] an optional parameter that will be passed to your custom checking function - can be anything
     * @param {Object} [user = null] an optional parameter that will be passed to your custom checking function - it should be the user object, but doesn't need to
     * @returns {Boolean} false if the arguments are incorrect or the role can't perform the action on the model 
     */
    check: (roleName, modelName, actionName, {data = null, user = null} = {}) => {
        const dotter = new dotObj('->');
        const modelPermissions = dotter.pick(`${roleName}->${modelName}`, module.exports.__private.permissionsJson);
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
        const actionPermission = dotter.pick(`${roleName}->${modelName}->${actionName}`, module.exports.__private.permissionsJson);
        //Check if there are any permissions for the given action
        if (typeof actionPermission !== 'string' && typeof actionPermission !== 'boolean'){
            logger.error(`There's no permission defined for role: ${roleName}, model: ${modelName}, action: ${actionName}`);
            return false;
        }
        //If there's a custom permission function defined, return its result
        if (actionPermission === 'function'){
            return module.exports.__private.permissionFunctions[roleName][modelName][actionName](data, user);
        } else {
            //Otherwise return the given permission - it must be boolean
            return actionPermission;
        }
    },
    /**
     * @description loads permissions to the module and validates them. Needs to be called before using the check function
     */
    init: () => {
        module.exports.__private.permissionsJson = getPermissionsJson(module.exports.__private.permissionsPath);
        validatePermissions(module.exports.__private.permissionsJson, module.exports.__private.permissionFunctions);
    },
    __private: {
        permissionsPath: path.resolve(__dirname, '../../config/permissions.json'),
        permissionsJson: null,
        permissionFunctions,
        validatePermissions,
        getPermissionsJson
    }
};