var common = require('./common');

// Returns/updates user's AWS credentials
//
// GET mode
// receives the following parameters:
// http-method
// user-uuid
//
// POST mode
// receives the following parameters:
// http-method
// user-uuid
// aws-access-key
// aws-secret-key
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

                switch (event['http-method']) {
                    case 'GET':
                        context.done(null, {
                            'aws-access-key': data.Items[0].aws_access_key.S,
                            'aws-secret-key': data.Items[0].aws_secret_key.S
                        });
                        break;
                    case 'POST':
                        common.queryUserByUuid(userUuid, function (err, data) {
                            if (err) {
                                context.fail(JSON.stringify({
                                    code: 'Error',
                                    message: 'Failed to find user by uuid ' + userUuid + ' , ' + err
                                }));
                            } else if (data.Count === 1) {
                                common.updateUserAwsCredentials(data.Items[0].email.S, event['aws-access-key'], event['aws-secret-key'], function (err, data) {
                                    if (err) {
                                        context.fail(JSON.stringify({
                                            code: 'Error',
                                            message: 'Failed to update AWS credentials for user ' + userUuid + ' , ' + err
                                        }));
                                    } else {
                                        context.done();
                                    }
                                });
                            }
                        });
                        break;
                }

            } else {
                context.fail(JSON.stringify({
                    code: 'NotFound',
                    message: 'Failed to find user by user uuid ' + userUuid
                }));
            }
        }
    });
};
