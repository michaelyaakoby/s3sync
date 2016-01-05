var common = require('./common');
var AWS = require('aws-sdk');
var async = require('async');
var http = require('https');

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
exports.handler = function (event, context) {
    console.log('Received event:', JSON.stringify(event, null, 2));

    var userUuid = event['user-uuid'];

    switch (event['http-method']) {
        case 'GET':
            common.queryAgentByUserUuidAndSubnet(userUuid, event.subnet, function (err, data) {
                if (err) {
                    context.fail(JSON.stringify({
                        code: 'Error',
                        message: 'Failed to query agent by subnet ' + event.subnet + ' , ' + err
                    }));
                } else {
                    var agents = [];
                    data.Items.map(function (agent) {
                        agents.push({
                            instance: agent.instance.S,
                            'agent-status': agent.agent_status.S
                        });
                    });

                    context.done(null, agents);
                }
            });
            break;
        case 'POST':
            async.waterfall([
                function (callback) {
                    // #1 - get AWS access and secret key
                    common.queryUserByUuid(userUuid, function (err, data) {
                        if (err) {
                            common.errorHandler(callback, 'Failed to query user by uuid ' + userUuid + ' , ' + err);
                        } else {
                            if (data.Count === 1) {
                                callback(null, data.Items[0].name.S, data.Items[0].aws_access_key.S, data.Items[0].aws_secret_key.S);
                            } else {
                                common.errorHandler(callback, 'Failed to find user by user uuid ' + userUuid);
                            }
                        }
                    });
                },

                function(name, awsAccessKey, awsSecretKey, callback){
                    // #2 - get subnet's VPC
                    var options = {
                        accessKeyId: awsAccessKey,
                        secretAccessKey: awsSecretKey,
                        region: event.region
                    };

                    var ec2 = new AWS.EC2(options);
                    ec2.describeSubnets({
                        SubnetIds: [event.subnet]
                    }, function(err, data) {
                        if (err){
                            common.errorHandler(callback, 'Failed to describe subnets for user uuid ' + userUuid + ', ' + err);
                        }else{
                            if(data.Subnets.length === 1){
                                var vpcId = data.Subnets[0].VpcId;
                                callback(null, name, awsAccessKey, awsSecretKey, vpcId);
                            }else{
                                common.errorHandler(callback, 'Failed to describe subnet by id ' + event.subnet + ', ' + err);
                            }
                        }
                    });
                },

                function (name, awsAccessKey, awsSecretKey, vpcId, callback) {
                    // #3 - read CF template from github
                    var options = {
                        method: 'GET',
                        host: 'raw.githubusercontent.com',
                        port: 443,
                        path: '/michaelyaakoby/s3sync/master/agent/s3sync-template.json'
                    };

                    http.request(options, function (response) {
                        var str = '';

                        response.on('data', function (chunk) {
                            str += chunk;
                        });

                        response.on('end', function () {
                            callback(null, name, awsAccessKey, awsSecretKey, vpcId, str);
                        });
                    }).end();
                },

                function (name, awsAccessKey, awsSecretKey, vpcId, cfTemplate, callback) {
                    // #4 - create CF in user's account
                    var options = {
                        region: event.region,
                        accessKeyId: awsAccessKey,
                        secretAccessKey: awsSecretKey
                    };
                    var cf = new AWS.CloudFormation(options);

                    var params = {
                        StackName: name + new Date().getTime(),
                        TemplateBody: cfTemplate,
                        Capabilities: ['CAPABILITY_IAM'],
                        NotificationARNs: [common.sns_topic],
                        Parameters: [
                            {
                                ParameterKey: 'VpcId',
                                ParameterValue: vpcId
                            },
                            {
                                ParameterKey: 'SubnetId',
                                ParameterValue: event.subnet
                            },
                            {
                                ParameterKey: 'KeyPair',
                                ParameterValue: event.keypair
                            }
                        ]
                    };

                    cf.createStack(params, function (err, data) {
                        if (err) {
                            common.errorHandler(callback, 'Failed to create stack for user uuid ' + userUuid + ', ' + err);
                        } else {
                            callback(null);
                        }
                    });
                }
            ], function (err, result) {
                if (err) {
                    context.fail(JSON.stringify({
                        code: 'Error',
                        message: 'Failed to create stack for user uuid ' + userUuid + ' , ' + err
                    }));
                } else {
                    common.createAgent(userUuid, event.region, event.vpc, event.subnet, function (err, data) {
                        context.done();
                    });
                }
            });
            break;
    }
};









