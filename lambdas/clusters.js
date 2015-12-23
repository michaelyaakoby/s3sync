var common = require('./common.js');
var AWS = require('aws-sdk');

// Returns/created user's clusters
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
// region
// vpc
// subnet
// cluster-mgmt-ip
// user-name
// password
exports.handler = function (event, context) {
    console.log('Received event:', JSON.stringify(event, null, 2));

    var userUuid = event['user-uuid'];
    switch (event['http-method']) {
        case 'GET':
            common.queryClustersByUserUuid(userUuid, function (err, data) {
                if (err) {
                    context.fail(JSON.stringify({
                        code: 'Error',
                        message: 'Failed to query cluster by user uuid ' + userUuid + ' , ' + err
                    }));
                } else {
                    context.done(null, data.Items);
                }
            });
            break;
        case 'POST':
            common.createCluster(userUuid, event.region, event.vpc, event.subnet, event['cluster-mgmt-ip'], event['user-name'], event.password, function (err, data) {
                if (err) {
                    context.fail(JSON.stringify({
                        code: 'Error',
                        message: 'Failed to create cluster with user uuid ' + userUuid + ' , ' + err
                    }));
                } else {
                    context.done();
                }
            });
            break;
    }
};






