var common = require('./common.js');
var AWS = require('aws-sdk');
var async = require('async');

// Returns user's S3 buckets
// receives the following parameters:
// user-uuid
exports.handler = function (event, context) {
    console.log('Received event:', JSON.stringify(event, null, 2));

    var userUuid = event['user-uuid'];
    common.queryUserByUuid(userUuid, function (err, data) {
        if (err) {
            context.fail(JSON.stringify({
                code: 'Error',
                message: 'Failed to query user by uuid ' + userUuid + ' , ' + err
            }));
        } else {
            if (data.Count === 1) {
                var options = {
                    accessKeyId: data.Items[0].aws_access_key.S,
                    secretAccessKey: data.Items[0].aws_secret_key.S
                };
                var s3 = new AWS.S3(options);
                var cloudwatch = new AWS.CloudWatch(options);

                async.waterfall([
                        function (callback) {
                            s3.listBuckets(function (err, data) {
                                if (err) {
                                    common.errorHandler(callback, 'Failed to list buckets for user uuid ' + userUuid + ' , ' + err);
                                } else {
                                    callback(null, data.Buckets);
                                }
                            });
                        },

                        function (buckets, callback) {
                            async.map(buckets, doTheWork, function (err, result) {
                                if (err) {
                                    common.errorHandler(callback, 'Failed to get NumberOfObjects metric for user uuid ' + userUuid + ' , ' + err);
                                } else {
                                    callback(null, result);
                                }
                            });

                            function doTheWork(bucket, internalCallback) {
                                console.log('Get NumberOfObjects for bucket - ' + bucket.Name);
                                var yesterday = new Date();
                                yesterday.setDate(yesterday.getDate() - 1);

                                cloudwatch.getMetricStatistics({
                                    MetricName: 'NumberOfObjects',
                                    Namespace: 'AWS/S3',
                                    Period: 3600,
                                    Statistics: ['Average'],
                                    StartTime: yesterday,
                                    EndTime: new Date(),
                                    Dimensions: [
                                        {
                                            "Name": "BucketName",
                                            "Value": bucket.Name
                                        },
                                        {
                                            "Name": "StorageType",
                                            "Value": "AllStorageTypes"
                                        }
                                    ]
                                }, function (err, stats) {
                                    if (err) {
                                        common.errorHandler(internalCallback, 'Failed to get NumberOfObjects metric for bucket ' + bucket.Name + ' , ' + err);
                                    } else {
                                        console.log('Received :', JSON.stringify(stats, null, 2));
                                        bucket.NumberOfObjects = stats.Datapoints[0].Average;
                                        internalCallback(null, bucket);
                                    }
                                });
                            }
                        },

                        function (buckets, callback) {
                            async.map(buckets, doTheWork, function (err, result) {
                                if (err) {
                                    common.errorHandler(callback, 'Failed to get BucketSizeBytes metric for user uuid ' + userUuid + ' , ' + err);
                                } else {
                                    callback(null, result);
                                }
                            });

                            function doTheWork(bucket, internalCallback) {
                                console.log('Get BucketSizeBytes for bucket - ' + bucket.Name);
                                var yesterday = new Date();
                                yesterday.setDate(yesterday.getDate() - 1);

                                cloudwatch.getMetricStatistics({
                                    MetricName: 'BucketSizeBytes',
                                    Namespace: 'AWS/S3',
                                    Period: 3600,
                                    Statistics: ['Average'],
                                    StartTime: yesterday,
                                    EndTime: new Date(),
                                    Dimensions: [
                                        {
                                            "Name": "BucketName",
                                            "Value": bucket.Name
                                        },
                                        {
                                            "Name": "StorageType",
                                            "Value": "StandardStorage"
                                        }
                                    ]
                                }, function (err, stats) {
                                    if (err) {
                                        common.errorHandler(internalCallback, 'Failed to get BucketSizeBytes metric for bucket ' + bucket.Name + ' , ' + err);
                                    } else {
                                        console.log('Received :', JSON.stringify(stats, null, 2));
                                        bucket.BucketSizeBytes = stats.Datapoints[0].Average;
                                        internalCallback(null, bucket);
                                    }
                                });
                            }
                        }
                    ],
                    function (err, result) {
                        if (err) {
                            context.fail(JSON.stringify({
                                code: 'Error',
                                message: 'Failed to get buckets for user uuid ' + userUuid + ' , ' + err
                            }));
                        } else {
                            context.done(null, result);
                        }
                    }
                );
            } else {
                context.fail(JSON.stringify({
                    code: 'NotFound',
                    message: 'Unable to find user by user uuid ' + userUuid
                }));
            }
        }
    });
};

