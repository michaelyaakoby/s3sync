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
                        var requestId = common.uuid();

                        return common.invokeLambda('dfioClusterInfo', {
                            userUuid: user.uid,
                            awsAccessKey: user.awsAccessKey,
                            awsSecretKey: user.awsSecretKey,
                            requestId: requestId,
                            subnet: cluster.subnet,
                            region: cluster.region,
                            ip: cluster.ip,
                            username: cluster.username,
                            password: cluster.password
                        }).then(function () {
                            return {
                                cluster: {
                                    ip: cluster.ip,
                                    name: cluster.name,
                                    type: cluster.type,
                                    region: cluster.region,
                                    subnet: cluster.subnet
                                },
                                requestId: requestId
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






