var common = require('./common');

// Returns user's key pairs
// receives the following parameters:
// authorization
// region
exports.handler = common.eventHandler(
    function (event, user) {
        // #1 get all key pairs in region
        return common.describeKeyPairs(user.awsAccessKey, user.awsSecretKey, event.region)

            // #2 format the response
            .then(function (keypairsData) {
                return Object.keys(keypairsData.KeyPairs).map(function (key) {
                    return keypairsData.KeyPairs[key];
                });
            });
    }
);