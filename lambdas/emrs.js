var common = require('./common');

exports.handler = common.eventHandler(
    function (event, user) {
        return common.listEMRClusters(user.awsAccessKey, user.awsSecretKey)

            .then(function (response) {
                return response.Clusters;
            })

            .map(function (cluster) {
                return {
                    id: cluster.Id,
                    name: cluster.Name,
                    state: cluster.Status.State
                };
            })
    }
);
