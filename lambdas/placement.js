var common = require('./common');
var AWS = require('aws-sdk');
var async = require('async');

// Returns user's placements - regions, vpcs, subnets
// receives the following parameters:
// user-uuid
exports.handler = function (event, context) {
    console.log('Received event:', JSON.stringify(event, null, 2));

    var userUuid = event['user-uuid'];
    async.waterfall([
            function (callback) {
                // #1 - get AWS access and secret key
                common.queryUserByUuid(userUuid, function (err, data) {
                    if (err) {
                        common.errorHandler(callback, 'Failed to query user by uuid ' + userUuid + ' , ' + err);
                    } else {
                        if (data.Count === 1) {
                            callback(null, data.Items[0].aws_access_key.S, data.Items[0].aws_secret_key.S);
                        } else {
                            common.errorHandler(callback, 'Failed to find user by user uuid ' + userUuid);
                        }
                    }
                });
            },

            function (awsAccessKey, awsSecretKey, callback) {
                // #2 - describe regions
                var options = {
                    accessKeyId: awsAccessKey,
                    secretAccessKey: awsSecretKey
                };
                var ec2 = new AWS.EC2(options);

                ec2.describeRegions(function (err, data) {
                    if (err) {
                        common.errorHandler(callback, 'Failed to describe regions for user uuid ' + userUuid);
                    } else {
                        var regionNames = Object.keys(data.Regions).map(function(key){
                            return data.Regions[key].RegionName;
                        });

                        callback(null, awsAccessKey, awsSecretKey, regionNames);
                    }
                });
            },

            function (awsAccessKey, awsSecretKey, regionNames, callback) {
                // #3 - describe subnets
                async.map(regionNames, doTheWork, function (err, results) {
                    if (err) {
                        common.errorHandler(callback, 'Failed to describe subnets for user uuid ' + userUuid);
                    } else {
                        var flattened = results.reduce(function(a, b) {
                            return a.concat(b);
                        });
                        callback(null, flattened);
                    }
                });

                function doTheWork(regionName, internalCallback) {
                    var options = {
                        accessKeyId: awsAccessKey,
                        secretAccessKey: awsSecretKey,
                        region: regionName
                    };
                    var ec2 = new AWS.EC2(options);

                    ec2.describeSubnets(function (err, data) {
                        if (err) {
                            common.errorHandler(internalCallback, 'Failed to describe subnets for user uuid ' + event['user-uuid']);
                        } else {

                            var subnets = Object.keys(data.Subnets).map(function(key){
                                var subnet = data.Subnets[key];

                                return {
                                    region: regionName,
                                    vpcId: subnet.VpcId,
                                    subnetId: subnet.SubnetId,
                                    cidrBlock: subnet.CidrBlock,
                                    tags: subnet.Tags
                                };
                            });

                            internalCallback(null, subnets);
                        }
                    });
                }
            }
        ],

        function (err, result) {
            if (err) {
                context.fail(JSON.stringify({
                    code: 'Error',
                    message: 'Failed to get placement for user uuid ' + userUuid + ', ' + err
                }));
            } else {
                context.done(null, result);
            }
        });
};

