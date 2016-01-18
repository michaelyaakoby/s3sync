var common = require('./common.js');

// Returns/created user's clusters
//
// GET mode
// receives the following parameters:
// authorization
// http-method
//
// POST mode
// receives the following parameters:
// authorization
// http-method
// region
// subnet
// cluster-mgmt-ip
// user-name
// password
// cluster-type
exports.handler = common.eventHandler(
    function (event, user) {

        switch (event['http-method']) {
            case 'GET':
                // #1 - query for clusters by user's uuid
                return common.queryClustersByUserUid(user.uid)

                    // #2 - parse the saved clusters and return them
                    .then(function (data) {
                        return data.Items.map(function (cluster) {
                            return {
                                ip: cluster.cluster_ip.S,
                                name: cluster.cluster_name.S,
                                subnet: cluster.subnet.S,
                                region: cluster.region.S,
                                type: cluster.cluster_type.S,
                                username: cluster.user_name.S,
                                password: cluster.password.S
                            };
                        });
                    })
                    .map(function (cluster) {
                        return common.queryAgentByUserUidAndSubnet(user.uid, cluster.subnet).then(function (agent) {
                            if (agent.Count) {
                                var request = "'<netapp><volume-get-iter><desired-attributes><volume-attributes><volume-id-attributes><name/></volume-id-attributes><volume-space-attributes><size/></volume-space-attributes></volume-attributes></desired-attributes></volume-get-iter></netapp>'";

                                var uuid = common.uuid();

                                var command = '/opt/NetApp/s3sync/agent/scripts/invoke-zapi.py --address ' + cluster.ip + ' --user ' + cluster.username + ' --password ' + cluster.password + ' --sns-topic ' + common.sns_topic + ' --request ' + request + ' --request-id ' + uuid;

                                return common.executeCommand(cluster.region, agent.Items[0].instance.S, user.awsAccessKey, user.awsSecretKey, 'Generic_ZAPI', command).then(function () {
                                    return {
                                        ip: cluster.ip,
                                        name: cluster.name,
                                        type: cluster.type,
                                        region: cluster.region,
                                        subnet: cluster.subnet,
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
                return common.createCluster(user.uid, event.region, event.subnet, event['cluster-mgmt-ip'], event['user-name'], event.password, event['cluster-type']);
                break;

        }
    }
);






