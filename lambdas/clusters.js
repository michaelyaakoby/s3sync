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
// vpc
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
                        var clusters = [];
                        data.Items.map(function (cluster) {
                            clusters.push({
                                ip: cluster.cluster_ip.S,
                                subnet: cluster.subnet.S,
                                region: cluster.region.S,
                                type: cluster.cluster_type.S
                            });
                        });
                        return clusters;
                    });
                break;

            case 'POST':
                // #1 - create cluster for user
                return common.createCluster(userUuid, event.region, event.subnet, event['cluster-mgmt-ip'], event['user-name'], event.password, event['cluster-type']);
                break;

        }
    }
);






