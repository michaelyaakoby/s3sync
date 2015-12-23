var common = require('./common.js');
var AWS = require('aws-sdk');

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
    common.queryUserByUuid(userUuid, function (err, data) {
        if (err) {
            context.fail(JSON.stringify({
                code: 'Error',
                message: 'Failed to query user by uuid ' + userUuid + ' , ' + err
            }));
        } else {
            if (data.Count === 1) {

                common.queryAgentByUserUuidAndSubnet(userUuid, event.subnet, function (err, data) {
                    if (err) {
                        common.errorHandler({
                            code: 'Error',
                            message: 'Failed to query agent by subnet ' + event.subnet + ' , ' + err
                        }, callback);
                    } else {
                        var instance = data.Items[0].instance.S;

                        var ssm = new AWS.SSM(options = {
                            region: event.region,
                            accessKeyId: data.Items[0].aws_access_key.S,
                            secretAccessKey: data.Items[0].aws_secret_key.S
                        });

                        var params = {
                            DocumentName: 'AWS-RunShellScript',
                            InstanceIds: [instance]
                        };

                        ssm.sendCommand(params, function (err, data) {
                            if (err) {
                                context.fail(JSON.stringify({
                                    code: 'Error',
                                    message: 'Failed to send command for user uuid ' + userUuid + ' , ' + err
                                }));
                            } else {
                                common.queryExportsByUserUuidAndSubnetAndIp(userUuid, event.subnet, event['cluster-mgmt-ip'], function(err, data){
                                    if(err){
                                        common.errorHandler({
                                            code: 'Error',
                                            message: 'Failed to query exports by subnet ' + event.subnet + ' , ' + err
                                        }, callback);
                                    }else{
                                        context.done(null, data.Items);
                                    }
                                });
                            }
                        });
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
