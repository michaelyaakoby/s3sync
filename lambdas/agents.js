var common = require('./common');
var AWS = require('aws-sdk');
var async = require('async');
var http = require('https');

var box_cf_template = 'https://raw.githubusercontent.com/michaelyaakoby/s3sync/master/agent/s3sync-template.json';

var sns_topic = 'arn:aws:sns:us-west-2:718273455463:occmservice';

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
// vpc
// subnet
// keypair
exports.handler = function (event, context) {
    console.log('Received event:', JSON.stringify(event, null, 2));

    var userUuid = event['user-uuid'];

    switch (event['http-method']) {
        case 'GET':
            common.queryAgentByUserUuidAndSubnet(userUuid, event.subnet, function (err, data) {
                if(err){
                    context.fail(JSON.stringify({
                        code: 'Error',
                        message: 'Failed to query agent by subnet ' + event.subnet + ' , ' + err
                    }));
                }else{
                    context.done(null, data);
                }
            });
            break;
        case 'POST':
            async.waterfall([
                function (callback) {
                    // #1 - get AWS access and secret key
                    common.queryUserByUuid(userUuid, function (err, data) {
                        if (err) {
                            common.errorHandler({
                                code: 'Error',
                                message: 'Failed to query user by uuid ' + userUuid + ' , ' + err
                            }, callback);
                        } else {
                            if (data.Count === 1) {
                                callback(null, data.Items[0].name.S, data.Items[0].aws_access_key.S, data.Items[0].aws_secret_key.S);
                            } else {
                                common.errorHandler({
                                    code: 'NotFound',
                                    message: 'Failed to find user by user uuid ' + userUuid
                                }, callback);
                            }
                        }
                    });
                },

                function(name, awsAccessKey, awsSecretKey, callback){
                    // #2- read CF template from github
                    var options = {
                        method: 'GET',
                        host: 'raw.githubusercontent.com',
                        port: 443,
                        path: '/michaelyaakoby/s3sync/master/agent/s3sync-template.json'
                    };

                    http.request(options, function(response){
                        var str = '';

                        response.on('data', function (chunk) {
                            str += chunk;
                        });

                        response.on('end', function () {
                            callback(null, name, awsAccessKey, awsSecretKey, str);
                        });
                    }).end();
                },

                function (name, awsAccessKey, awsSecretKey, cfTemplate, callback) {
                    // #3 - create CF in user's account
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
                        NotificationARNs: [sns_topic],
                        Parameters: [
                            {
                                ParameterKey: 'VpcId',
                                ParameterValue: event.vpc
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
                            common.errorHandler({
                                code: 'Error',
                                message: 'Failed to create stack for user uuid ' + userUuid + ', ' + err
                            }, callback);
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









