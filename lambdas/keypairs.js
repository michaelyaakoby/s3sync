var common = require('./common');

// Returns user's key pairs
// receives the following parameters:
// http-method
// user-uuid
// region
exports.handler = common.eventHandler(
    function (event, user) {
        // #1 get all key pairs in region
        return common.describeKeyPairs(user.aws_access_key.S, user.aws_secret_key.S, event.region)

            // #2 format the response
            .then(function (keypairsData) {
                return Object.keys(keypairsData.KeyPairs).map(function (key) {
                    return keypairsData.KeyPairs[key];
                });
            });
    }
);