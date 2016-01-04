var common = require('./common');
var AWS = require('aws-sdk');
var async = require('async');

// Returns/created user's copy configuration
//
// GET mode
// receives the following parameters:
// http-method
// user-uuid
// subnet
//
// POST mode
// receives the following parameters:
// http-method
// user-uuid
// region
// subnet
// source
// target
exports.handler = function (event, context) {
    console.log('Received event:', JSON.stringify(event, null, 2));

    var userUuid = event['user-uuid'];
    switch (event['http-method']) {
        case 'GET':
            common.queryCopyConfigurationByUserUuidAndSubnet(userUuid, event.subnet, function (err, data) {
                if (err) {
                    context.fail(JSON.stringify({
                        code: 'Error',
                        message: 'Failed to query copy configuration by user uuid ' + userUuid + ' , ' + err
                    }));
                } else {
                    var results = [];
                    data.Items.map(function (item) {
                        results.push({
                            id: item.id.S,
                            status: item.copy_status.S,
                            source: item.source.S,
                            target: item.target.S
                        });
                    });

                    context.done(null, results);
                }
            });
            break;
        case 'POST':
            var id = common.uuid();

            async.waterfall([
                    function (callback) {
                        // #1 - create copy configuration entry in dynamo db
                        common.createCopyConfiguration(userUuid, event.subnet, event.source, event.target, id, function (err, data) {
                            if (err) {
                                common.errorHandler(callback, 'Failed to create copy configuration for user uuid ' + userUuid + ' , ' + err);
                            } else {
                                callback(null);
                            }
                        });
                    },
                    function (callback) {
                        // #2 - get agent instance
                        common.queryAgentByUserUuidAndSubnet(userUuid, event.subnet, function (err, data) {
                            if (err) {
                                common.errorHandler(callback, 'Failed to query agent by user uuid ' + userUuid + ' , ' + err);
                            } else {
                                callback(null, data.Items[0].instance.S);
                            }
                        });
                    },
                    function (instance, callback) {
                        // #3 - get user's AWS credentials
                        common.queryUserByUuid(userUuid, function (err, data) {
                            if (err) {
                                common.errorHandler(callback, 'Failed to query user by uuid ' + userUuid + ' , ' + err);
                            } else {
                                callback(null, instance, data.Items[0].aws_access_key.S, data.Items[0].aws_secret_key.S);
                            }
                        });
                    },
                    function (instance, awsAccessKey, awsSecretKey, callback) {
                        // #4 - execute command
                        var command = '/opt/NetApp/s3sync/agent/scripts/copy-to-s3.py  -s ' + event.source + ' -t ' + event.target + ' -c ' + id + ' -n ' + common.sns_topic;
                        common.executeCommand(event.region, instance, awsAccessKey, awsSecretKey, 'Copy', command, function (err, data) {
                            if (err) {
                                common.errorHandler(callback, 'Failed to execute command for instance ' + instance + ' , ' + err);
                            } else {
                                callback(null);
                            }
                        });
                    }
                ],
                function (err, result) {
                    if (err) {
                        context.fail(JSON.stringify({
                            code: 'Error',
                            message: 'Failed to copy for user uuid ' + userUuid + ' , ' + err
                        }));
                    } else {
                        context.done();
                    }
                });
            break;
    }
};
