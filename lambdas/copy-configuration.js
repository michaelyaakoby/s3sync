var common = require('./common');
var Promise = require('bluebird');

// Returns/created user's copy configuration
//
// GET mode
// receives the following parameters:
// http-method
// user-uuid
// subnet
//
// POST mode
// receives the following parameters:
// http-method
// user-uuid
// region
// subnet
// source
// target
exports.handler = common.eventHandler(
    function (event, user) {
        var userUuid = event['user-uuid'];

        switch (event['http-method']) {
            case 'GET':
                // #1 query for copy configuration data by user's uuid and subnet
                var copyConfigurationPromise;

                if (event.subnet) {
                    copyConfigurationPromise = common.queryCopyConfigurationByUserUuidAndSubnet(userUuid, event.subnet);
                } else {
                    copyConfigurationPromise = common.queryCopyConfigurationByUserUuid(userUuid);
                }

                return copyConfigurationPromise.then(function (data) {
                    var results = [];
                    data.Items.map(function (item) {
                        results.push({
                            id: item.id.S,
                            status: item.copy_status.S,
                            source: item.copy_source.S,
                            target: item.target.S
                        });
                    });

                    return results;
                });

                break;

            case 'POST':
                // #1.1 query for agent for user's uuid and subnet and return the instance id or fail
                var agentInstanceIdPromise = common.queryAgentByUserUuidAndSubnet(userUuid, event.subnet)
                    .then(function (agentsData) {
                        if (!agentsData.Count) {
                            throw new common.NotFoundError('No agent found for user ' + userUuid + ' and subnet ' + event.subnet);
                        } else if (!agentsData.Items[0].instance || !agentsData.Items[0].instance.S || agentsData.Items[0].instance.S == '') {
                            throw new common.NotReadyError('Agent not initialized for user ' + userUuid + ' and subnet ' + event.subnet);
                        } else {
                            return agentsData.Items[0].instance.S;
                        }
                    });

                var copyConfigurationId;
                // #1.2 create copy configuration record if not exists
                var copyConfigurationIdPromise = common.queryCopyConfigurationByUserUuidAndSubnetAndParams(userUuid, event.subnet, event.source, event.target).then(function (copyConfiguration) {
                    if (!copyConfiguration.Count) {
                        copyConfigurationId = common.uuid();
                        return common.createCopyConfiguration(userUuid, event.subnet, event.source, event.target, copyConfigurationId);
                    } else {
                        copyConfigurationId = copyConfiguration.Items[0].id.S;
                        return null;
                    }
                });

                // #2 wait for the promises to complete and execute copy to s3
                return Promise.join(agentInstanceIdPromise, copyConfigurationIdPromise, function (agentInstanceId) {
                    var target = event.target + '/' + copyConfigurationId;
                    var command = '/opt/NetApp/s3sync/agent/scripts/copy-to-s3.py  -s ' + event.source + ' -t ' + target + ' -c ' + copyConfigurationId + ' -n ' + common.sns_topic;
                    return common.executeCommand(event.region, agentInstanceId, user.aws_access_key.S, user.aws_secret_key.S, 'Copy', command);
                }).then(function () {
                    return copyConfigurationId;
                });

                break;
        }
    }
);
