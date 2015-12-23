var common = require('./common.js');
var AWS = require('aws-sdk');

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
                var s3 = new AWS.S3(options = {
                    accessKeyId: data.Items[0].aws_access_key.S,
                    secretAccessKey: data.Items[0].aws_secret_key.S
                });

                s3.listBuckets(function (err, data) {
                    if (err) {
                        context.fail(JSON.stringify({
                            code: 'Error',
                            message: 'Failed to list buckets for user uuid ' + userUuid + ' , ' + err
                        }));
                    } else {
                        context.done(null, data.Buckets);
                    }
                });
            } else {
                context.fail(JSON.stringify({
                    code: 'NotFound',
                    message: 'Unable to find user by user uuid ' + userUuid
                }));
            }
        }
    });
};

