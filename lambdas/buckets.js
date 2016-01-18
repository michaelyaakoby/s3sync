var common = require('./common.js');

// Returns user's S3 buckets
// receives the following parameters:
// authorization
exports.handler = common.eventHandler(
    function (event, user) {
        return common.listBuckets(user.awsAccessKey, user.awsSecretKey)

            .then(function (bucketsData) {
                return bucketsData.Buckets;
            })

            .map(function (bucket) {
                var requestId = common.uuid();
                return common.invokeLambda('dfioBucketMetrics', {
                    bucket: bucket.Name,
                    awsAccessKey: user.awsAccessKey,
                    awsSecretKey: user.awsSecretKey,
                    requestId: requestId
                })
                    .then(function () {
                        return {
                            name: bucket.Name,
                            creationDate: bucket.CreationDate,
                            requestId: requestId
                        };
                    });
            });
    }
);

