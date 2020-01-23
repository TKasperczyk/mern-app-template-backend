'use strict';

/** 
 * A list of functions that allow to customize permission checks for the given role, model and action.
 * The structure of this file should correspond to /config/permissions.json
 * Full description with details: https://github.com/TKasperczyk/mern-app-template#permissions
 */

module.exports = {
    user: { //role
        'data.user': { //model
            get: (data, user) => { //action
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