var common = require('./common');

// Login to the system
// receives the following parameters:
// email
// password
exports.handler = function (event, context) {
    console.log('Received event:', JSON.stringify(event, null, 2));

    common.queryUserByEmail(event.email, function (err, data) {
        if (err) {
            context.fail(JSON.stringify({
                code: 'Error',
                message: 'Failed to query user by email ' + event.email + ' , ' + err
            }));
        } else {
            if (data.Count === 0) {
                // user not found
                context.fail(JSON.stringify(unauthorizedError));
            } else if (data.Count === 1) {
                // provided email is already in the DB - compare passwords
                if (data.Items[0].password.S === event.password) {
                    context.done(null, {uuid: data.Items[0].user_uuid.S});
                } else {
                    context.fail(JSON.stringify(unauthorizedError));
                }
            }
        }
    });
};

var unauthorizedError = {
    code: 'Unauthorized',
    message: 'Wrong email/password combination'
};
