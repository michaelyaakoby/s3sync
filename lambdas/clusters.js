var common = require('./common.js');

// Returns/created user's clusters
//
// GET mode
// receives the following parameters:
// http-method
// user-uuid
//
// POST mode
// receives the following parameters:
// http-method
// user-uuid
// region
// subnet
// cluster-mgmt-ip
// user-name
// password
// cluster-type
exports.handler = common.eventHandler(
    function (event, user) {
        var userUuid = event['user-uuid'];

        switch (event['http-method']) {
            case 'GET':
                // #1 - query for clusters by user's uuid
                return common.queryClustersByUserUuid(userUuid)

                    // #2 - parse the saved clusters and return them
                    .then(function (data) {
                        return data.Items.map(function (cluster) {
                            return {
                                ip: cluster.cluster_ip.S,
                                subnet: cluster.subnet.S,
                                region: cluster.region.S,
                                type: cluster.cluster_type.S,
                                username: cluster.user_name.S,
                                password: cluster.password.S
                            };
                        });
                    })
                    .map(function (cluster) {
                        return common.queryAgentBySubnet(cluster.subnet).then(function (agent) {
                            if (agent.Count == 1) {
                                var request = "'<netapp><cluster-identity-get><desired-attributes><cluster-identity-info><cluster-name></cluster-name><cluster-uuid></cluster-uuid></cluster-identity-info></desired-attributes></cluster-identity-get></netapp>'";

                                var uuid = common.uuid();

                                var command = '/opt/NetApp/s3sync/agent/scripts/invoke-zapi.py --address ' + event['cluster-mgmt-ip'] + ' --user ' + cluster.username + ' --password ' + cluster.password + ' --sns-topic ' + common.sns_topic + ' --request ' + request + ' --request-id ' + uuid;

                                return common.executeCommand(cluster.region, agent.Items[0].instance.S, user.aws_access_key.S, user.aws_secret_key.S, 'Generic_ZAPI', command).then(function () {
                                    return {
                                        cluster: {
                                            ip: cluster.ip,
                                            type: cluster.type,
                                            region: cluster.region,
                                            subnet: cluster.subnet
                                        },
                                        requestId: uuid
                                    }
                                });
                            } else {
                                throw new common.NotFoundError('No agent found for subnet ' + cluster.subnet);
                            }
                        });
                    });

                break;

            case 'POST':
                // #1 - create cluster for user
                return common.createCluster(userUuid, event.region, event.subnet, event['cluster-mgmt-ip'], event['user-name'], event.password, event['cluster-type']);
                break;

        }
    }
);






