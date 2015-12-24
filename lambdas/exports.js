var common = require('./common');
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
                        if(agentData.Items[0].instance){
                            var instance = agentData.Items[0].instance.S;

                            var ssm = new AWS.SSM(options = {
                                region: event.region,
                                accessKeyId: userData.Items[0].aws_access_key.S,
                                secretAccessKey: userData.Items[0].aws_secret_key.S
                            });

                            var documentName = 'ExportsScript_' + new Date().getTime();

                            //TODO - username/password and sns should be parameters to the lambda
                            var command = '/opt/NetApp/s3sync/agent/scripts/find-exports.py --address ' + event['cluster-mgmt-ip'] + ' --user admin --password Netapp234 --sns-topic arn:aws:sns:us-west-2:718273455463:occmservice';

                            var content = {
                                schemaVersion: '1.2',
                                description: 'Get NFS exports',
                                parameters: {},
                                runtimeConfig: {
                                    "aws:runShellScript":{
                                        properties: [{
                                            id: '0.aws:runShellScript',
                                            runCommand: [command]
                                        }]
                                    }
                                }
                            };

                            var params = {
                                Name: documentName,
                                Content: JSON.stringify(content)
                            };

                            //TODO - have to find and use or create and use
                            ssm.createDocument(params, function(err, createDocumentData) {
                                if(err){
                                    context.fail(JSON.stringify({
                                        code: 'Error',
                                        message: 'Failed to to create document ,' + err
                                    }));
                                }else{
                                    var params = {
                                        DocumentName: documentName,
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

                        }else{
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
