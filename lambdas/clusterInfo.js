var common = require('./common.js');

exports.handler = common.eventHandler(
    function(event) {
        var subnet = event.subnet;

        return common.queryAgentByUserUidAndSubnet(event.userUuid, subnet)
            .then(function (agent) {
                if (agent.Count == 1) {
                    var request = "'<netapp><volume-get-iter><desired-attributes><volume-attributes><volume-id-attributes><name/></volume-id-attributes><volume-space-attributes><size/></volume-space-attributes></volume-attributes></desired-attributes></volume-get-iter></netapp>'";
                    var command = '/opt/NetApp/s3sync/agent/scripts/invoke-zapi.py --address ' + event.ip + ' --user ' + event.username + ' --password ' + event.password + ' --sns-topic ' + common.sns_topic + ' --request ' + request + ' --request-id ' + event.requestId;

                    return common.executeCommand(event.region, agent.Items[0].instance.S, event.awsAccessKey, event.awsSecretKey, 'Generic_ZAPI', command).then(function () {
                        return null;
                    });
                } else {
                    throw new Error('No agent found for subnet ' + subnet);
                }
            });
    }
);