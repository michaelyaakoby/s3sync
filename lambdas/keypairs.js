var common = require('./common');
var AWS = require('aws-sdk');

// Returns user's key pairs
// receives the following parameters:
// http-method
// user-uuid
// region
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
                    secretAccessKey: data.Items[0].aws_secret_key.S,
                    region: event.region
                };

                var ec2 = new AWS.EC2(options);
                ec2.describeKeyPairs({}, function (err, data) {
                    if (err) {
                        context.fail(JSON.stringify({
                            code: 'Error',
                            message: 'Failed to describe key pairs for uuid ' + userUuid + ' , ' + err
                        }));
                    } else {
                        console.log("kkkkk", JSON.stringify(data.KeyPairs, null, 2));
                        var keyPairs = Object.keys(data.KeyPairs).map(function (key) {
                            return data.KeyPairs[key];
                        });
                        context.done(null, keyPairs);
                    }
                });
            } else {
                context.fail(JSON.stringify({
                    code: 'NotFound',
                    message: 'Failed to find user by user uuid ' + userUuid
                }));
            }
        }
    });


};