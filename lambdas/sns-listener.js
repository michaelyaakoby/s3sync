var common = require('./common.js');
var Promise = require('bluebird');

// handles the following notifications:
// agent status
// receives the following parameters:
// subnet
// instance
// status
//
// cluster exports
// receives the following parameters:
// subnet
// cluster management ip
// exports
//
// copy result
// receives the following parameters:
// subnet
// status
// id
exports.handler = common.eventHandler(
    function (event) {
        var subject = event.Records[0].Sns.Subject;
        var message = JSON.parse(event.Records[0].Sns.Message);
        var actionPromise;

        switch (subject) {

            case 'deploy-agent-completed':
                var agentInfo = message['deploy-agent'];
                var subnet = agentInfo['subnet-id'];
                var instance = agentInfo['instance-id'];

                // #1 query agent by subnet and extract agent's user's uuid or fail
                actionPromise = common.queryAgentBySubnet(subnet)

                    // #2 extract agent user's uuid
                    .then(function (agentsData) {
                        if (!agentsData.Count) {
                            throw new Error('No agent found for subnet ' + subnet);
                        } else {
                            return agentsData.Items[0].user_uuid.S;
                        }
                    })

                    // #3 update agent record with instance id
                    .then(function (user_uuid) {
                        return common.updateAgent(user_uuid, subnet, instance);
                    });
                break;

            case 'copy-to-s3':
                var id = message['copy-id'];
                var status = (message['copy-completed']) ? 'completed' : JSON.stringify(message);

                // #1 query for copy configuration
                return common.queryCopyConfigurationById(id)

                    // #2 extract the copy configuration or fail
                    .then(function (copyConfigurationsData) {
                        if (!copyConfigurationsData.Count) {
                            throw new Error('No copy configuration found for copy configuration id: ' + id);
                        } else {
                            return copyConfigurationsData.Items[0];
                        }
                    })

                    // #3 update copy configuration status
                    .then(function (copyConfiguration) {
                        return common.updateCopyConfiguration(copyConfiguration.user_uuid.S, id, status).return(copyConfiguration);
                    })

                    // #4 submit EMR step if needed
                    .then(function (copyConfiguration) {
                        if (copyConfiguration.copy_source.S.indexOf('access_logs') == -1) {
                            return null;
                        } else {
                            return common.queryUserByUidWithExceptions(copyConfiguration.user_uuid.S)

                                .then(function (user) {
                                    return common.listEMRClusters(user.awsAccessKey, user.awsSecretKey)

                                        .then(function (response) {
                                            return response.Clusters.filter(function (value) {
                                                return value.Status.State.indexOf('TERM') != 0
                                            })
                                        })

                                        .then(function (clusters) {
                                            return [user, clusters[0].Id, copyConfiguration.target.S];
                                        });
                                })

                                .spread(function (user, clusterId, targetBucket) {
                                    return common.submitEMRStep(user.awsAccessKey, user.awsSecretKey, 'LogAnalyzer-' + id, clusterId, 's3://datafabric-emr-applications/emr-applications/sparkloganalyzer_2.11-1.0.jar', 'com.netapp.s3sync.spark.SparkLogAnalyzer', 's3://datafabric-emr-applications/data1/*', targetBucket, id);
                                });
                        }
                    });
                break;

            case 'find-exports':
                var exportsData = message['find-exports'];
                var subnet = exportsData['subnet-id'];
                var clusterMgmtIp = exportsData['cluster-mgmt-ip'];

                // #1 query cluster by subnet & management ip
                return common.queryClustersBySubnetAndIp(subnet, clusterMgmtIp)

                    // #2 extract the user's uui from the cluster data or fail
                    .then(function (clustersData) {
                        if (!clustersData.Count) {
                            throw new Error('No cluster data found for subnet: ' + subnet + ' and cluster management ip: ' + clusterMgmtIp);
                        } else {
                            return clustersData.Items[0].user_uuid.S;
                        }
                    })

                    // #3 update exports data
                    .then(function (user_uuid) {
                        return common.updateExports(user_uuid, subnet, clusterMgmtIp, exportsData.exports);
                    });

                break;

            case 'reset-demo':
                return common.scanCopyConfiguration()
                    .then(function (data) {
                        return data.Items;
                    })
                    .map(function (copyConfiguration) {
                        return common.deleteCopyConfiguration(copyConfiguration.user_uuid.S, copyConfiguration.copy_id.S);
                    });
                break;

            default:
                actionPromise = Promise.reject(new Error('Unexpected message!'));
                break;
        }

        return actionPromise
            .then(function () {
                console.log('Successfully handled "' + subject + '"');
                return null;
            })
            .catch(function (err) {
                console.log('Failed handling "' + subject + '"');
                return null;
            });
    }
);
