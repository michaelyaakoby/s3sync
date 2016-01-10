var common = require('./common');
var AWS = require('aws-sdk');
var async = require('async');

exports.handler = common.eventHandler(
    function (event) {
        // #1 retrieve all copy configurations with specific status
        return common.scanCopyConfigurationByCopyStatus('completed')

            // #2 log and return the copy configurations
            .then(function (copyConfigurationsData) {
                console.log('Found ' + copyConfigurationsData.Items.length + ' copy configurations in status completed to be re-processed...');
                return copyConfigurationsData.Items;
            })

            // #3 re-process each copy configuration found
            .map(function (copyConfiguration) {
                var copyConfigurationString = JSON.stringify(copyConfiguration);

                console.log('Re-processing copy configuration: ' + copyConfigurationString);

                var user_uuid = copyConfiguration.user_uuid.S;
                var subnet = copyConfiguration.subnet.S;
                var id = copyConfiguration.id.S;
                var source = copyConfiguration.source.S;
                var target = copyConfiguration.target.S;

                var commandData = {};

                // #3.1 query for the user data or fail
                return common.queryUserByUuid(user_uuid)

                    // #3.2 get the user or fail
                    .then(function (usersData) {
                        if (!usersData.Count) {
                            throw new Error('User: ' + user_uuid + ' not found for copy configuration: ' + copyConfigurationString);
                        } else {
                            return usersData.Items[0];
                        }
                    })

                    // #3.3 collect the user's aws access & secret keys
                    .then(function (user) {
                        commandData.awsAccessKey = user.aws_access_key.S;
                        commandData.awsSecretKey = user.aws_secret_key.S;
                        return null;
                    })

                    // #3.4 query for the copy configuration's agent
                    .then(function () {
                        return common.queryAgentByUserUuidAndSubnet(user_uuid, subnet);
                    })

                    // #3.5 collect the agent's instance id and region or fail
                    .then(function (agentsData) {
                        if (!agentsData.Count) {
                            throw new Error('No agent data found for copy configuration: ' + copyConfigurationString);
                        }
                        var agent = agentsData.Items[0];
                        if (!agent.instance || ! agent.instance.S || agent.instance.S == '') {
                            throw new Error('No instance found for copy configuration: ' + copyConfigurationString + ', agent: ' + JSON.stringify(agent));
                        } else if (!agent.region || ! agent.region.S || agent.region.S == '') {
                            throw new Error('No region found for copy configuration: ' + copyConfigurationString + ', agent: ' + JSON.stringify(agent));
                        } else {
                            commandData.instance = agent.instance.S;
                            commandData.region = agent.region.S;
                            return null;
                        }
                    })

                    // #3.6 update the copy configuration status to 'not initialized'
                    .then(function () {
                        return common.updateCopyConfiguration(user_uuid, subnet, id, 'not initialized')
                    })

                    // #3.7 execute the copy-to-s3 command
                    .then(function() {
                        var command = '/opt/NetApp/s3sync/agent/scripts/copy-to-s3.py  -s ' + source + ' -t ' + target + ' -c ' + id + ' -n ' + common.sns_topic;
                        return common.executeCommand(region, instance, awsAccessKey, awsSecretKey, 'Copy', command);
                    });
            });
    }
);