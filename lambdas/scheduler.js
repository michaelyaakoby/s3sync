var common = require('./common');
var AWS = require('aws-sdk');

exports.handler = function (event, context) {
    console.log('Received event:', JSON.stringify(event, null, 2));

    context.done();
};