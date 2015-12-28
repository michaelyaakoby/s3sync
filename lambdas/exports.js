var common = require('./common');
var AWS = require('aws-sdk');

var sns_topic = 'arn:aws:sns:us-west-2:718273455463:occmservice';
// Returns specific cluster exports
//
// GET mode
// receives the following parameters:
// http-method
// user-uuid
// region
// subnet
// cluster-mgmt-ip
exports.handler = function (event, context) {
    console.log('Received event:', JSON.stringify(event, null, 2));

    var userUuid = event['user-uuid'];
    common.queryUserByUuid(userUuid, function (err, userData) {
        if (err) {
            context.fail(JSON.stringify({
                code: 'Error',
                message: 'Failed to query user by uuid ' + userUuid + ' , ' + err
            }));
        } else {
            if (userData.Count === 1) {
                common.queryAgentByUserUuidAndSubnet(userUuid, event.subnet, function (err, agentData) {
                    if (err) {
                        context.fail(JSON.stringify({
                            code: 'Error',
                            message: 'Failed to query agent by subnet ' + event.subnet + ' , ' + err
                        }));
                    } else {
                        if (agentData.Items[0].instance) {

                            var instance = agentData.Items[0].instance.S;
                            var awsAccessKey = userData.Items[0].aws_access_key.S;
                            var awsSecretKey = userData.Items[0].aws_secret_key.S;
                            //TODO - username/password and sns should be parameters to the lambda
                            var command = '/opt/NetApp/s3sync/agent/scripts/find-exports.py --address ' + event['cluster-mgmt-ip'] + ' --user admin --password Netapp234 --sns-topic ' + sns_topic;
                            common.executeCommand(event.region, instance, awsAccessKey, awsSecretKey, 'Export', command, function (err, data) {
                                if (err) {
                                    context.fail({
                                        code: 'Error',
                                        message: 'Failed to execute command for subnet ' + event.subnet + ' , ' + err
                                    });
                                } else {
                                    common.queryExportsByUserUuidAndSubnetAndIp(userUuid, event.subnet, event['cluster-mgmt-ip'], function (err, data) {
                                        if (err) {
                                            context.fail({
                                                code: 'Error',
                                                message: 'Failed to query exports by subnet ' + event.subnet + ' , ' + err
                                            });
                                        } else {
                                            if (data.Count === 0) {
                                                context.done(null, []);
                                            } else if (data.Count === 1) {
                                                context.done(null, data.Items[0].exports.S);
                                            } else {
                                                context.fail({
                                                    code: 'Error',
                                                    message: 'Got unexpected number of exports for subnet ' + event.subnet + ' , ' + err
                                                });
                                            }
                                        }
                                    });
                                }
                            });
                        } else {
                            // agent is not ready yet
                            content.done(null, {message: 'agent not ready yet'});
                        }
                    }
                });
            } else {
                context.fail(JSON.stringify({
                    code: 'NotFound',
                    message: 'Unable to find user by user uuid ' + userUuid
                }));
            }
        }
    });
};
