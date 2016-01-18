var common = require('./common');

// Registers new user in the system, throws error if provided email exists in DB
//
// receives the following parameters:
// aws-access-key
// aws-secret-key
exports.handler = common.eventHandler(
    function (event, user) {
        var awsAccessKey = event['aws-access-key'];
        var awsSecretKey = event['aws-secret-key'];

        // #1 validate the aws credentials
        return common.listBuckets(awsAccessKey, awsSecretKey)

            // #2 convert the error if we failed
            .catch(function() {
                throw new common.BadRequestError("Invalid credentials");
            })

            // #3 update the user credentials in dynamo
            .then(function () {
                return common.updateUserAwsCredentials(user.email)
            });
    }
);

