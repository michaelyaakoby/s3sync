var common = require('./common');

// Registers new user in the system, throws error if provided email exists in DB
//
// receives the following parameters:
// email
// password
// name
// aws-access-key
// aws-secret-key
exports.handler = common.eventHandler(
    function (event) {
        // #1 - query existing user by email
        return common.queryUserByEmail(event.email)

            // #2 - validate email is not already in use
            .then(function (data) {
                if (data.Count) {
                    throw new Error('Email ' + event.email + ' already registered');
                }
            })

            // #3 - register new user and return its UUID
            .then(function () {
                var uuid = common.uuid();
                return common.createUser(uuid, event.email, event.password, event.name, event['aws-access-key'], event['aws-secret-key'])
                    .then(function () {
                        return {uuid: uuid};
                    });
            });
    }
);

