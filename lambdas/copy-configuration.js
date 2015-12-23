var common = require('./common.js');
var AWS = require('aws-sdk');

// Returns/created user's copy configuration
//
// GET mode
// receives the following parameters:
// http-method
// user-uuid
// subnet
//
// POST mode
// receives the following parameters:
// http-method
// user-uuid
// subnet
// source
// target
exports.handler = function (event, context) {
    console.log('Received event:', JSON.stringify(event, null, 2));

    var userUuid = event['user-uuid'];
    switch (event['http-method']) {
        case 'GET':
            common.queryCopyConfigurationByUserUuidAndSubnet(userUuid, event.subnet, function (err, data) {
                if (err) {
                    context.fail(JSON.stringify({
                        code: 'Error',
                        message: 'Failed to query copy configuration by user uuid ' + userUuid + ' , ' + err
                    }));
                } else {
                    context.done(null, data);
                }
            });
            break;
        case 'POST':
            var uuid = common.uuid();
            common.createCopyConfiguration(userUuid, event.subnet, event.source, event.target, function (err, data) {
                if (err) {
                    context.fail(JSON.stringify({
                        code: 'Error',
                        message: 'Failed to create copy configuration for user uuid ' + userUuid + ' , ' + err
                    }));
                } else {
                    context.done();
                }
            });
            break;
    }
};
