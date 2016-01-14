var common = require('./common');
var AWS = require('aws-sdk');
var Promise = require("bluebird");

// Returns/creates user's agents
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
// keypair
exports.handler = common.eventHandler(
    function (event, user) {
        var userUuid = event['user-uuid'];

        switch (event['http-method']) {
            case 'GET':
                var agentsPromise;
                if (event.subnet) {
                    agentsPromise = common.queryAgentByUserUuidAndSubnet(userUuid, event.subnet);
                } else {
                    agentsPromise = common.queryAgentByUserUuid(userUuid);
                }

                return agentsPromise
                    .then(function (agents) {
                        return agents.Items.map(function (agent) {
                            return {
                                instance: agent.instance.S,
                                region: agent.region.S
                            };
                        });
                    })

                    .map(function (agent) {
                        return common.describeInstance(agent.instance, user.aws_access_key.S, user.aws_secret_key.S, agent.region);
                    });

                break;

            case 'POST':
                var username = user.name.S;
                var awsAccessKey = user.aws_access_key.S;
                var awsSecretKey = user.aws_secret_key.S;
                var region = event.region;
                var subnet = event.subnet;
                var keypair = event.keypair;

                // #1 extract VPC ID for subnet or fail
                var vpcIdPromise = common.describeSubnets(awsAccessKey, awsSecretKey, region, subnet)
                    .then(function (data) {
                        if (data.Subnets.length) {
                            return data.Subnets[0].VpcId;
                        } else {
                            throw new Error('Subnet ' + subnet + ' not found');
                        }
                    });

                // #2 get CF template
                var cfTemplatePromise = common.getUrlContent('raw.githubusercontent.com', 443, '/michaelyaakoby/s3sync/master/agent/s3sync-template.json');

                // #3 wait for the promises to complete and create CF stack
                return Promise.join(vpcIdPromise, cfTemplatePromise, function (vpcId, cfTemplate) {
                    return common.createCFStack(awsAccessKey, awsSecretKey, region, vpcId, subnet, keypair, username, cfTemplate);
                })
                    .then(function () {
                        return common.createAgent(userUuid, region, subnet);
                    });
                break;
        }
    }
);