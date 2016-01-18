var common = require('./common');

// Returns specific cluster exports
//
// GET mode
// receives the following parameters:
// http-method
// authorization
// region
// subnet
// cluster-mgmt-ip
exports.handler = common.eventHandler(
    function (event, user) {

        // #1 - query the agent by uuid and subnet
        return common.queryAgentByUserUidAndSubnet(user.uid, event.subnet)

            // #2 - validate agent exists and initialized or fail
            .then(function (agentsData) {
                if (!agentsData.Count) {
                    throw new common.NotFoundError('No agent found for user ' + user.uid + ' and subnet ' + event.subnet);
                } else if (!agentsData.Items[0].instance || !agentsData.Items[0].instance.S || agentsData.Items[0].instance.S == '') {
                    throw new common.NotReadyError('Agent not initialized for user ' + user.uid + ' and subnet ' + event.subnet);
                } else {
                    return agentsData.Items[0];
                }
            })

            // #3 - get cluster password
            .then(function (agent) {
                return common.queryClustersBySubnetAndIp(event.subnet, event['cluster-mgmt-ip']).then(function (cluster) {
                    if (cluster.Count == 0) {
                        throw new common.NotFoundError('No cluster found for subnet ' + event.subnet + ' and cluster mgmt ip ' + event['cluster-mgmt-ip']);
                    } else {
                        return {
                            agent: agent,
                            username: cluster.Items[0].user_name.S,
                            password: cluster.Items[0].password.S
                        };
                    }
                });
            })

            // #4 - issue list exports command
            .then(function (info) {
                var instance = info.agent.instance.S;
                var awsAccessKey = user.awsAccessKey;
                var awsSecretKey = user.awsSecretKey;
                var command = '/opt/NetApp/s3sync/agent/scripts/find-exports.py --address ' + event['cluster-mgmt-ip'] + ' --user ' + info.username + ' --password ' + info.password + ' --sns-topic ' + common.sns_topic;
                common.executeCommand(event.region, instance, awsAccessKey, awsSecretKey, 'Export', command);
            })

            // #4 query list of exports
            .then(function (data) {
                return common.queryExportsByUserUuidAndSubnetAndIp(user.uid, event.subnet, event['cluster-mgmt-ip']);
            })

            // #5 convert the list of exports to response
            .then(function (exportsData) {
                if (!exportsData.Count) {
                    console.log('No export record in DB for user ' + user.uid + ' and subnet ' + event.subnet);
                    return [];
                } else if (!exportsData.Items[0].exports || !exportsData.Items[0].exports.S || exportsData.Items[0].exports.S == '') {
                    console.log('No exports in DB record for user ' + user.uid + ' and subnet ' + event.subnet);
                    return [];
                } else {
                    return JSON.parse(exportsData.Items[0].exports.S);
                }
            });
    }
);
