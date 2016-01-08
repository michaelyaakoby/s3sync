var common = require('./common.js');
var Promise = require('bluebird');

// Returns user's S3 buckets
// receives the following parameters:
// user-uuid
exports.handler = common.eventHandler(
    function (event, user) {
        var awsAccessKey = user.aws_access_key.S;
        var awsSecretKey = user.aws_secret_key.S;

        var today = new Date();
        var yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

        // #1 list s3 buckets
        return common.listBuckets(awsAccessKey, awsSecretKey).then(function (bucketsData) { return bucketsData.Buckets; })

            // #2 get metrics for each bucket in parallel and return updated bucket object with the metrics on it
            .map(function (bucket) {
                var extractAverage = function (stats) {
                    if (stats.Datapoints.length) {
                        return stats.Datapoints[0].Average;
                    } else {
                        return -1;
                    }
                };

                var numberOfObjectsPromise = common.getBucketHourlyAverageMetricStats(awsAccessKey, awsSecretKey, bucket.Name, 'NumberOfObjects', yesterday, today).then(extractAverage);
                var bucketSizeBytesPromise = common.getBucketHourlyAverageMetricStats(awsAccessKey, awsSecretKey, bucket.Name, 'BucketSizeBytes', yesterday, today).then(extractAverage);

                return Promise.join(numberOfObjectsPromise, bucketSizeBytesPromise, function(numberOfObjects, bucketSizeBytes) {
                    bucket.NumberOfObjects = numberOfObjects;
                    bucket.BucketSizeBytes = bucketSizeBytes;
                    return bucket;
                });
            });
    }
);

