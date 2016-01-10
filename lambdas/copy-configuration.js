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
                return common.queryCopyConfigurationByUserUuidAndSubnet(userUuid, event.subnet)

                    // #2 format and return the response
                    .then(function (data) {
                        var results = [];
                        data.Items.map(function (item) {
                            results.push({
                                id: item.id.S,
                                status: item.copy_status.S,
                                source: item.source.S,
                                target: item.target.S
                            });
                        });
                        return results;
                    });
                break;

            case 'POST':
                var id = common.uuid();

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

                // #1.2 create copy configuration record
                var createCopyConfigurationPromise = common.createCopyConfiguration(userUuid, event.subnet, event.source, event.target, id);

                // #2 wait for the promises to complete and execute copy to s3
                return Promise.join(agentInstanceIdPromise, createCopyConfigurationPromise, function (agentInstanceId) {
                    var target = event.target + '/' + id;
                    var command = '/opt/NetApp/s3sync/agent/scripts/copy-to-s3.py  -s ' + event.source + ' -t ' + target + ' -c ' + id + ' -n ' + common.sns_topic;
                    return common.executeCommand(event.region, agentInstanceId, user.aws_access_key.S, user.aws_secret_key.S, 'Copy', command);
                }).then(function(){
                });
                break;
        }
    }
);
