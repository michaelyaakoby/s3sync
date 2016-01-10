var common = require('./common');

// Returns specific cluster exports
//
// GET mode
// receives the following parameters:
// http-method
// user-uuid
// region
// subnet
// cluster-mgmt-ip
exports.handler = common.eventHandler(
    function(event, user) {
        var userUuid = event['user-uuid'];

        // #1 - query the agent by uuid and subnet
        return common.queryAgentByUserUuidAndSubnet(userUuid, event.subnet)

            // #2 - validate agent exists and initialized or fail
            .then(function (agentsData) {
                if (!agentsData.Count) {
                    throw new common.NotFoundError('No agent found for user ' + userUuid + ' and subnet ' + event.subnet);
                } else if (!agentsData.Items[0].instance || !agentsData.Items[0].instance.S || agentsData.Items[0].instance.S == '') {
                    throw new common.NotReadyError('Agent not initialized for user ' + userUuid + ' and subnet ' + event.subnet);
                } else {
                    return agentsData.Items[0];
                }
            })

            // #3 issue list exports command
            .then(function (agent) {
                var instance = agent.instance.S;
                var awsAccessKey = user.aws_access_key.S;
                var awsSecretKey = user.aws_secret_key.S;
                //TODO - username/password and sns should be parameters to the lambda
                var command = '/opt/NetApp/s3sync/agent/scripts/find-exports.py --address ' + event['cluster-mgmt-ip'] + ' --user admin --password Netapp234 --sns-topic ' + common.sns_topic;
                return common.executeCommand(event.region, instance, awsAccessKey, awsSecretKey, 'Export', command);
            })

            // #4 query list of exports
            .then(function (data) {
                return common.queryExportsByUserUuidAndSubnetAndIp(userUuid, event.subnet, event['cluster-mgmt-ip']);
            })

            // #5 convert the list of exports to response
            .then(function (exportsData) {
                if (!exportsData.Count) {
                    console.log('No export record in DB for user ' + userUuid + ' and subnet ' + event.subnet);
                    return [];
                } else if (!exportsData.Items[0].exports || !exportsData.Items[0].exports.S || exportsData.Items[0].exports.S == '') {
                    console.log('No exports in DB record for user ' + userUuid + ' and subnet ' + event.subnet);
                    return [];
                } else {
                    return exportsData.Items[0].exports.S;
                }
            });
    }
);
