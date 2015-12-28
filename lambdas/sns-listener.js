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
    var message = JSON.parse(event.Records[0].Sns.Message);

    switch (event.Records[0].Sns.Subject) {
        case 'deploy-agent-completed':
            console.log('Got deploy-agent-completed message', JSON.stringify(message, null, 2));
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
        case 'find-exports':
            console.log('Got find-exports message', JSON.stringify(message, null, 2));
            var exportsData = message['find-exports'];
            subnet = exportsData['subnet-id'];
            var clusterMgmtIp = exportsData['cluster-mgmt-ip'];

            common.queryExportsBySubnetAndIp(subnet, clusterMgmtIp, function (err, data) {
                if (err) {
                    context.fail(JSON.stringify({
                        code: 'Error',
                        message: 'Failed to query exports with subnet ' + subnet + ' , ' + err
                    }));
                } else {
                    if (data.Count === 0) {
                        // first time that we received exports - find user uuid in clusters table
                        common.queryClustersBySubnetAndIp(subnet, clusterMgmtIp, function (err, data) {
                            if (err) {
                                context.fail(JSON.stringify({
                                    code: 'Error',
                                    message: 'Failed to query exports with subnet ' + subnet + ' , ' + err
                                }));
                            } else {
                                if (data.Count === 1) {
                                    var userUuid = data.Items[0].user_uuid.S;
                                    common.updateExports(userUuid, subnet, clusterMgmtIp, exportsData.exports, function (err, data) {
                                        if (err) {
                                            context.fail(JSON.stringify({
                                                code: 'Error',
                                                message: 'Failed to update exports for ' + subnet + ' and cluster management ip ' + clusterMgmtIp
                                            }));
                                        } else {
                                            context.done();
                                        }
                                    });
                                } else {
                                    context.fail(JSON.stringify({
                                        code: 'Error',
                                        message: 'Got unexpected number of clusters for subnet ' + subnet + ' and cluster management ip ' + clusterMgmtIp
                                    }));
                                }
                            }
                        });
                    } else if (data.Count === 1) {
                        // got update for existing data
                        var userUuid = data.Items[0].user_uuid.S;
                        common.updateExports(userUuid, subnet, clusterMgmtIp, exportsData.exports, function (err, data) {
                            if (err) {
                                context.fail(JSON.stringify({
                                    code: 'Error',
                                    message: 'Failed to update exports for ' + subnet + ' and cluster management ip ' + clusterMgmtIp
                                }));
                            } else {
                                context.done();
                            }
                        });
                    } else {
                        context.fail(JSON.stringify({
                            code: 'Error',
                            message: 'Got unexpected number of exports for subnet ' + subnet + ' and cluster management ip ' + clusterMgmtIp
                        }));
                    }
                }
            });
            break;
        case 'copy-to-s3':
            var subnetId = message['subnet-id'];
            var copyId = message['copy-id'];
            common.queryCopyConfigurationBySubnetAndId(subnetId, copyId, function (err, data) {
                if (err) {
                    context.fail(JSON.stringify({
                        code: 'Error',
                        message: 'Failed to query copy configuration by subnet ' + subnetId + ' and id ' + copyId + ', ' + err
                    }));
                } else {
                    if (data.Count === 1) {
                        var userUuid = data.Items[0].user_uuid.S;
                        var status = (message['copy-completed']) ? 'completed' : JSON.stringify(message);
                        common.updateCopyConfiguration(userUuid, subnetId, copyId, status, function (err, data) {
                            if (err) {
                                context.fail(JSON.stringify({
                                    code: 'Error',
                                    message: 'Failed to update copy configuration by subnet ' + subnetId + ' and id ' + copyId + ', ' + err
                                }));
                            } else {
                                context.done();
                            }
                        });
                    } else {
                        context.fail(JSON.stringify({
                            code: 'Error',
                            message: 'Got unexpected number of copy configurations for subnet ' + subnetId + ' and id ' + copyId
                        }));
                    }
                }
            });
            break;
        default:
            // finish the function on unexpected events (it gets a lot of CF events while creating an agent)
            console.log('Unhandled message:', JSON.stringify(message, null, 2));
            context.done();
    }
};

