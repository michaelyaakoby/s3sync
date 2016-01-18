var common = require('./common.js');
var Promise = require('bluebird');

exports.handler = common.eventHandler(
    function (event) {
        var awsAccessKey = event.awsAccessKey;
        var awsSecretKey = event.awsSecretKey;
        var bucketName = event.bucket;
        var requestId = event.requestId;

        var today = new Date();
        var yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        var extractAverage = function (stats) {
            if (stats.Datapoints.length) {
                return stats.Datapoints[0].Average;
            } else {
                return -1;
            }
        };

        var numberOfObjectsPromise = common.getBucketHourlyAverageMetricStats(awsAccessKey, awsSecretKey, bucketName, 'NumberOfObjects', yesterday, today).then(extractAverage);
        var bucketSizeBytesPromise = common.getBucketHourlyAverageMetricStats(awsAccessKey, awsSecretKey, bucketName, 'BucketSizeBytes', yesterday, today).then(extractAverage);

        Promise.join(numberOfObjectsPromise, bucketSizeBytesPromise, function (numberOfObjects, bucketSizeBytes) {
            var message = {
                bucketName: bucketName,
                requestId: requestId,
                numberOfObjects: numberOfObjects,
                bucketSizeBytes: bucketSizeBytes
            };

            return common.publishMessage(message, 'S3 info', common.sns_topic);
        });
    }
);