var common = require('./common');
var AWS = require('aws-sdk');
var async = require('async');

exports.handler = function (event, context) {
    console.log('Received event:', JSON.stringify(event, null, 2));

    common.scanCopyConfigurationByCopyStatus("completed", function (err, data) {
        if (err) {
            context.fail(JSON.stringify({
                code: 'Error',
                message: 'Failed to scan copy configurations by status \'completed\' , ' + err
            }));
        } else {
            console.log('Found ' + data.Items.length + ' copy configurations to be processed');

            async.each(
                data.Items,
                function(cc, ccCallback) {
                    console.log('Re-running copy configuration ' + JSON.stringify(cc));

                    var user_uuid = cc.user_uuid.S;
                    var subnet = cc.subnet.S;
                    var id = cc.id.S;
                    var source = cc.source.S;
                    var target = cc.target.S;

                    async.waterfall([
                        function (callback) {
                            // #1 - update copy configuration entry status in dynamo db
                            common.updateCopyConfiguration(user_uuid, subnet, id, 'not initialized', function (err, data) {
                                if (err) {
                                    common.errorHandler({
                                        code: 'Error',
                                        message: 'Failed to update copy configuration for user uuid ' + user_uuid + ' , subnet ' + subnet + ' id ' + id + ' to "not initialized" , ' + err
                                    }, callback);
                                } else {
                                    callback(null);
                                }
                            });
                        },
                        function (callback) {
                            // #2 - get agent instance
                            common.queryAgentByUserUuidAndSubnet(user_uuid, subnet, function (err, data) {
                                if (err) {
                                    common.errorHandler({
                                        code: 'Error',
                                        message: 'Failed to query agent by user uuid ' + user_uuid + ' , subnet ' + subnet + ' , ' + err
                                    }, callback);
                                } else {
                                    callback(null, data.Items[0].instance.S, data.Items[0].region.S);
                                }
                            });
                        },
                        function (instance, region, callback) {
                            // #3 - get user's AWS credentials
                            common.queryUserByUuid(user_uuid, function (err, data) {
                                if (err) {
                                    common.errorHandler({
                                        code: 'Error',
                                        message: 'Failed to query user by uuid ' + user_uuid + ' , ' + err
                                    }, callback);
                                } else {
                                    callback(null, instance, region, data.Items[0].aws_access_key.S, data.Items[0].aws_secret_key.S);
                                }
                            });
                        },
                        function (instance, region, awsAccessKey, awsSecretKey, callback) {
                            // #4 - execute command
                            var command = '/opt/NetApp/s3sync/agent/scripts/copy-to-s3.py  -s ' + source + ' -t ' + target + ' -c ' + id + ' -n ' + common.sns_topic;
                            common.executeCommand(region, instance, awsAccessKey, awsSecretKey, 'Copy', command, function (err, data) {
                                if (err) {
                                    common.errorHandler({
                                        code: 'Error',
                                        message: 'Failed to execute command for instance ' + instance + ' , of user ' + user_uuid + ' , ' + err
                                    }, callback);
                                } else {
                                    callback(null);
                                }
                            });
                        }
                    ],
                    function (err, result) {
                        if (err) {
                            common.errorHandler({
                                code: 'Error',
                                message: 'Failed re-running copy configuration for user uuid ' + user_uuid + ' , ' + err
                            }, ccCallback);
                        } else {
                            ccCallback(null);
                        }
                    });
                },
                function(err) {
                    if (err) {
                        context.fail(JSON.stringify({
                            code: 'Error',
                            message: 'Failed to re-run copy configurations by status "completed" ' + err
                        }));
                    } else {
                        console.log('Completed running ' + data.Items.length + ' copy configurations successfully');
                        context.done();
                    }
                }
            );

        }
    });
};