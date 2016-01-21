var common = require('./common');

// Login to the system
// receives the following parameters:
// token
exports.handler = common.eventHandler(
    function (event) {
        var accessToken = event.token;

        // #1 validate the amazon's access token and retrieve the user's profile
        return common.getAmazonProfile(accessToken)

            // #2 query or create the user and return the final response
            .then(function(profile) {
                var uid = profile.user_id;
                var name = profile.name;
                var email = profile.email;

                // #2.1 query for existing user
                return common.queryUserByUid(uid)

                    // #2.2 create the user if not found and return true/false if the user requires setup
                    .then(function (usersData) {
                        if (!usersData.Count) {
                            return common.createUser(uid, name, email).return(true);
                        } else {
                            var user = usersData.Items[0];
                            return common.isDynamoItemColumnUndefined(user.aws_access_key) || common.isDynamoItemColumnUndefined(user.aws_secret_key);
                        }
                    })

                    .then(function (requiresSetup) {
                        return common.createSQSQueue().then(function (queueName) {
                            return {
                                name: name,
                                email: email,
                                authorization: 'Bearer ' + common.jwtIssue(uid),
                                requiresSetup: requiresSetup,
                                queueName: queueName
                            };
                        })
                    })
            });
    }
);
