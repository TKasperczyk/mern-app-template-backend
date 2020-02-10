'use strict';

module.exports = (mongoose) => {
    const userSchema = new mongoose.Schema({
        username: {
            match: /^[a-zA-Z0-9_]{1,}$/,
            unique: true,
            required: true,
            type: String,
            trim: true,
            lowercase: true,
        },
        password: {
            match: /^.{1,}$/,
            select: false,
            required: true,
            type: String,
        },
        role: {
            required: true,
            type: String,
            default: 'user'
        }
    }, {
        collection: 'data.users'
    });

    return mongoose.model('data.user', userSchema);
};
