var common = require('./common');

// Login to the system
// receives the following parameters:
// email
// password
exports.handler = common.eventHandler(
    function (event) {
        // #1 - query the user by email
        return common.queryUserByEmail(event.email)

            // #2 - validate user found
            .then(function (data) {
                if (!data.Count) {
                    throw new Error('User ' + event.email + ' not found!');
                } else {
                    return data.Items[0];
                }
            })

            // #3 - match passed password and return user's uuid or fail
            .then(function (user) {
                if (user.password.S != event.password) {
                    throw new Error('User ' + event.email + ' provided invalid password!');
                } else {
                    return {uuid: user.user_uuid.S};
                }
            });
    },
    // error converter
    function (err) {
        return new common.UnauthorizedError();
    }
);
