var common = require('./common');
var async = require('async');

// Registers new user in the system, throws error if provided email exists in DB
//
// receives the following parameters:
// email
// password
// name
// aws-access-key
// aws-secret-key
exports.handler = function (event, context) {
    console.log('Received event:', JSON.stringify(event, null, 2));

    async.waterfall([
            function (callback) {
                // #1 - check if the email is not already registered
                common.queryUserByEmail(event.email, function (err, data) {
                    if (err) {
                        common.errorHandler({
                            code: 'Error',
                            message: 'Failed to query user by email ' + event.email + ' , ' + err
                        }, callback);
                    } else {
                        if (data.Count === 0) {
                            // continue to register step
                            callback(null);
                        } else {
                            // provided email is already in the DB
                            common.errorHandler({
                                code: 'Conflict',
                                message: 'User with email ' + event.email + ' is already registered'
                            }, callback);
                        }
                    }
                });
            },

            function (callback) {
                // #2 - register new user
                var uuid = common.uuid();
                common.createUser(uuid, event.email, event.password, event.name, event['aws-access-key'], event['aws-secret-key'], function (err, data) {
                    if (err) {
                        common.errorHandler({
                            code: 'Error',
                            message: 'Failed to create user with email ' + event.email + ' , ' + err
                        }, callback);
                    } else {
                        callback(null, uuid);
                    }
                });
            }
        ],

        function (err, uuid) {
            if (err) {
                context.fail(JSON.stringify(err));
            } else {
                context.done(null, {"uuid": uuid});
            }
        }
    );
};

