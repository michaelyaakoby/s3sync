var common = require('./common');
var Promise = require('bluebird');

// Returns/created user's copy configuration
//
// GET mode
// receives the following parameters:
// http-method
// authorization

//
// POST mode
// receives the following parameters:
// http-method
// authorization
// region
// subnet
// source
// target
exports.handler = common.eventHandler(
    function (event, user) {

        switch (event['http-method']) {
            case 'GET':
                return common.queryCopyConfigurationByUserUuid(user.uid).then(function (data) {
                    var results = [];
                    data.Items.map(function (item) {
                        results.push({
                            id: item.copy_id.S,
                            status: item.copy_status.S,
                            source: item.copy_source.S,
                            target: item.target.S,
                            lastUpdate: item.last_update.N
                        });
                    });

                    return results;
                });

                break;

            case 'POST':
                // #1.1 query for agent for user's uuid and subnet and return the instance id or fail
                var agentInstanceIdPromise = common.queryAgentByUserUidAndSubnet(user.uid, event.subnet)
                    .then(function (agentsData) {
                        if (!agentsData.Count) {
                            throw new common.NotFoundError('No agent found for user ' + user.uid + ' and subnet ' + event.subnet);
                        } else if (!agentsData.Items[0].instance || !agentsData.Items[0].instance.S || agentsData.Items[0].instance.S == '') {
                            throw new common.NotReadyError('Agent not initialized for user ' + user.uid + ' and subnet ' + event.subnet);
                        } else {
                            return agentsData.Items[0].instance.S;
                        }
                    });

                var copyConfigurationId;
                // #1.2 create copy configuration record if not exists
                var copyConfigurationIdPromise = common.queryCopyConfigurationByUserUuidAndParams(user.uid, event.source, event.target).then(function (copyConfiguration) {
                    if (copyConfiguration.Count == 0) {
                        copyConfigurationId = common.uuid();
                        return common.createCopyConfiguration(user.uid, copyConfigurationId, event.source, event.target);
                    } else {
                        copyConfigurationId = copyConfiguration.Items[0].copy_id.S;
                        return null;
                    }
                });

                // #2 wait for the promises to complete and execute copy to s3
                return Promise.join(agentInstanceIdPromise, copyConfigurationIdPromise, function (agentInstanceId) {
                    var target = event.target + '/' + copyConfigurationId;
                    var command = '/opt/NetApp/s3sync/agent/scripts/copy-to-s3.py  -s ' + event.source + ' -t ' + target + ' -c ' + copyConfigurationId + ' -n ' + common.sns_topic;
                    return common.executeCommand(event.region, agentInstanceId, user.awsAccessKey, user.awsSecretKey, 'Copy', command);
                }).then(function () {
                    return copyConfigurationId;
                });

                break;
        }
    }
);
