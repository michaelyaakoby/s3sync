var common = require('./common.js');
var AWS = require('aws-sdk');

// handles the following notifications:
// agent status
// receives the following parameters:
// subnet
// instance
// status
//
// cluster exports
// receives the following parameters:
// subnet
// cluster management ip
// exports
//
// copy result
// receives the following parameters:
// subnet
// status
// id
exports.handler = function (event, context) {
    console.log('Received event:', JSON.stringify(event, null, 2));
    var message = event.Records[0].Sns.Message;
    //console.log('From SNS:', message);

    switch (event.Records[0].Sns.Subject) {
        case 'deploy-agent-completed':
            console.log('Got deploy-agent-completed message', message);
            var agentInfo = message['deploy-agent'];
            var subnet = agentInfo['subnet-id'];
            var instance = agentInfo['instance-id'];
            var status = message.status;

            common.queryAgentBySubnet(subnet, function (err, data) {
                if (err) {
                    context.fail(JSON.stringify({
                        code: 'Error',
                        message: 'Failed to query agent by subnet ' + subnet + ' , ' + err
                    }));
                } else if (data.Count === 1) {
                    common.updateAgent(data.Items[0].user_uuid.S, subnet, instance, status, function (err, data) {
                        if (err) {
                            context.fail(JSON.stringify({
                                code: 'Error',
                                message: 'Failed to update agent with subnet ' + subnet + ' , ' + err
                            }));
                        } else {
                            context.done();
                        }
                    });
                } else {
                    context.fail(JSON.stringify({
                        code: 'Error',
                        message: 'Got unexpected number ' + data.Count + ' of agents for subnet ' + subnet
                    }));
                }
            });

            break;
        case 'exports':
            common.queryExportsBySubnetAndIp(message.subnet, message['cluster-mgmt-ip'], function (err, data) {
                if (err) {
                    context.fail(JSON.stringify({
                        code: 'Error',
                        message: 'Failed to query exports with subnet ' + message.subnet + ' , ' + err
                    }));
                } else {
                    if (data.Count === 0) {
                        // first time that we received exports - find user uuid in clusters table
                        common.queryClustersBySubnetAndIp(message.subnet, message['cluster-mgmt-ip'], function (err, data) {
                            if (err) {
                                context.fail(JSON.stringify({
                                    code: 'Error',
                                    message: 'Failed to query exports with subnet ' + message.subnet + ' , ' + err
                                }));
                            } else {
                                if (data.Count === 1) {
                                    var userUuid = data.Items[0].user_uuid.S;
                                    common.updateExports(userUuid, message.subnet, message['cluster-mgmt-ip'], message.exports, function (err, data) {
                                        if (err) {
                                            context.fail(JSON.stringify({
                                                code: 'Error',
                                                message: 'Failed to update exports for ' + message.subnet + ' and cluster management ip ' + message['cluster-mgmt-ip']
                                            }));
                                        } else {
                                            context.done();
                                        }
                                    });
                                } else {
                                    context.fail(JSON.stringify({
                                        code: 'Error',
                                        message: 'Got unexpected number of clusters for subnet ' + message.subnet + ' and cluster management ip ' + message['cluster-mgmt-ip']
                                    }));
                                }
                            }
                        });
                    } else if (data.Count === 1) {
                        // got update for existing data
                        var userUuid = data.Items[0].user_uuid.S;
                        common.updateExports(userUuid, message.subnet, message['cluster-mgmt-ip'], message.exports, function (err, data) {
                            if (err) {
                                context.fail(JSON.stringify({
                                    code: 'Error',
                                    message: 'Failed to update exports for ' + message.subnet + ' and cluster management ip ' + message['cluster-mgmt-ip']
                                }));
                            } else {
                                context.done();
                            }
                        });
                    } else {
                        context.fail(JSON.stringify({
                            code: 'Error',
                            message: 'Got unexpected number of exports for subnet ' + message.subnet + ' and cluster management ip ' + message['cluster-mgmt-ip']
                        }));
                    }
                }
            });
            break;
        case 'copy':
            common.queryCopyConfigurationBySubnetAndId(message.subnet, message.id, function (err, data) {
                if (err) {
                    context.fail(JSON.stringify({
                        code: 'Error',
                        message: 'Failed to query copy configuration by subnet ' + message.subnet + ' and id ' + message.id + ', ' + err
                    }));
                } else {
                    if (data.Count === 1) {
                        var userUuid = data.Items[0].user_uuid.S;
                        common.updateCopyConfiguration(userUuid, message.subnet, message.id, message.status, function (err, data) {
                            if (err) {
                                context.fail(JSON.stringify({
                                    code: 'Error',
                                    message: 'Failed to update copy configuration by subnet ' + message.subnet + ' and id ' + message.id + ', ' + err
                                }));
                            } else {
                                context.done();
                            }
                        });
                    } else {
                        context.fail(JSON.stringify({
                            code: 'Error',
                            message: 'Got unexpected number of copy configurations for subnet ' + message.subnet + ' and id ' + message.id
                        }));
                    }
                }
            });
            break;

    }
};

