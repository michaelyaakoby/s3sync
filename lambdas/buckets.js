var common = require('./common.js');
var Promise = require('bluebird');

// Returns user's S3 buckets
// receives the following parameters:
// user-uuid
exports.handler = common.eventHandler(
    function (event, user) {
        var awsAccessKey = user.aws_access_key.S;
        var awsSecretKey = user.aws_secret_key.S;

        return common.listBuckets(awsAccessKey, awsSecretKey).then(function (bucketsData) {
            return bucketsData.Buckets;
        })
            .map(function (bucket) {
                var requestId = common.uuid();
                return common.invokeLambda('bucketMetrics', {
                    bucket: bucket.Name,
                    awsAccessKey: user.aws_access_key.S,
                    awsSecretKey: user.aws_secret_key.S,
                    requestId: requestId
                }).then(function () {
                    return {
                        bucket: {
                            name: bucket.Name,
                            creationDate: bucket.CreationDate
                        },
                        requestId: requestId
                    };
                });
            });
    }
);

