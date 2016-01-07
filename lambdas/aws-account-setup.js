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
exports.handler = common.eventHandler(
    function (event, user) {
        switch (event['http-method']) {
            case 'GET':
                return {
                    'aws-access-key': user.aws_access_key.S,
                    'aws-secret-key': user.aws_secret_key.S
                };
                break;

            case 'POST':
                return common.updateUserAwsCredentials(user.email.S, event['aws-access-key'], event['aws-secret-key']);
                break;
        }
    }
);
