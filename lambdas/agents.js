var common = require('./common');
var Promise = require("bluebird");

// Returns/creates user's agents
//
// GET mode
// receives the following parameters:
// authorization
// http-method
// subnet (optional)
//
// POST mode
// receives the following parameters:
// authorization
// http-method
// region
// subnet
// keypair
exports.handler = common.eventHandler(
    function (event, user) {

        switch (event['http-method']) {
            case 'GET':
                var agentsPromise;
                if (event.subnet) {
                    agentsPromise = common.queryAgentByUserUidAndSubnet(user.uid, event.subnet);
                } else {
                    agentsPromise = common.queryAgentByUserUid(user.uid);
                }

                return agentsPromise
                    .then(function (agents) {
                        return agents.Items.map(function (agent) {
                            return {
                                instance: agent.instance.S,
                                subnet: agent.subnet.S,
                                region: agent.region.S
                            };
                        });
                    })

                    .map(function (agent) {
                        return common.describeInstance(agent.instance, user.awsAccessKey, user.awsSecretKey, agent.region)
                            .then(function (instance) {
                               return {
                                   instance: instance.instance,
                                   subnet: agent.subnet,
                                   region: instance.region,
                                   state: instance.state.Name
                               }
                            });
                    });

                break;

            case 'POST':
                // #1 extract VPC ID for subnet or fail
                var vpcIdPromise = common.describeSubnets(user.awsAccessKey, user.awsSecretKey, event.region, event.subnet)
                    .then(function (data) {
                        if (data.Subnets.length) {
                            return data.Subnets[0].VpcId;
                        } else {
                            throw new Error('Subnet ' + event.subnet + ' not found');
                        }
                    });

                // #2 get CF template
                var cfTemplatePromise = common.getUrlContent('raw.githubusercontent.com', 443, '/michaelyaakoby/s3sync/master/agent/s3sync-template.json');

                // #3 wait for the promises to complete and create CF stack
                return Promise.join(vpcIdPromise, cfTemplatePromise, function (vpcId, cfTemplate) {
                    return common.createCFStack(user.awsAccessKey, user.awsSecretKey, event.region, vpcId, event.subnet, event.keypair, user.name, cfTemplate);
                })
                    .then(function () {
                        return common.createAgent(user.uid, event.region, event.subnet);
                    });
                break;
        }
    }
);