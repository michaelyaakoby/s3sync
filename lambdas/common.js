var AWS = require('aws-sdk');

///// USERS /////
var users_table = new AWS.DynamoDB({params: {TableName: 'users'}});

exports.queryUserByEmail = function (email, onQueryResponse) {
    console.log('Query table ' + users_table.config.params.TableName + ' by email=' + email);
    users_table.query({
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
            ":email": {S: email}
        }
    }, function (err, data) {
        onQueryResponse(err, data);
    });
};

exports.queryUserByUuid = function (user_uuid, onQueryResponse) {
    console.log('Query table ' + users_table.config.params.TableName + ' by uuid=' + user_uuid);
    users_table.query({
        IndexName: 'user_uuid-index',
        KeyConditionExpression: 'user_uuid = :user_uuid',
        ExpressionAttributeValues: {
            ":user_uuid": {S: user_uuid}
        }
    }, function (err, data) {
        onQueryResponse(err, data);
    });
};


exports.createUser = function (user_uuid, email, password, name, awsAccessKey, awsSecretKey, onCreateResponse) {
    console.log('Put item in table ' + users_table.config.params.TableName + ' - uuid=' + user_uuid + ', email=' + email + ', password=' + password + ', name=' + name + ', aws access key=' + awsAccessKey + ', aws secret key=' + awsSecretKey);

    var item = {
        Item: {
            user_uuid: {S: user_uuid},
            email: {S: email},
            password: {S: password},
            name: {S: name},
            aws_access_key: {S: awsAccessKey},
            aws_secret_key: {S: awsSecretKey}
        }
    };

    users_table.putItem(item, function (err, data) {
        onCreateResponse(err, data);
    });
};

exports.updateUserAwsCredentials = function (email, awsAccessKey, awsSecretKey, onUpdateResponse) {
    console.log('Update item in table ' + users_table.config.params.TableName + ' - email=' + email + ', aws access key=' + awsAccessKey + ', aws secret key=' + awsSecretKey);

    users_table.updateItem({
        "Key": {
            "email": {S: email}
        },
        "UpdateExpression": "SET aws_access_key = :aws_access_key, aws_secret_key = :aws_secret_key",
        "ExpressionAttributeValues": {
            ":aws_access_key": {S: awsAccessKey},
            ":aws_secret_key": {S: awsSecretKey}
        }
    }, function (err, data) {
        onUpdateResponse(err, data);
    });
};

///// END USERS /////

///// CLUSTERS /////
var clusters_table = new AWS.DynamoDB({params: {TableName: 'clusters'}});

exports.queryClustersByUserUuid = function (userUuid, onQueryResponse) {
    console.log('Query table ' + clusters_table.config.params.TableName + ' by user uuid=' + userUuid);
    clusters_table.query({
        KeyConditionExpression: 'user_uuid = :user_uuid',
        ExpressionAttributeValues: {
            ":user_uuid": {S: userUuid}
        }
    }, function (err, data) {
        onQueryResponse(err, data);
    });
};

exports.queryClustersBySubnetAndIp = function (subnet, clusterIp, onQueryResponse) {
    console.log('Query table ' + clusters_table.config.params.TableName + ' by subnet=' + subnet + ', cluster ip=' + clusterIp);
    clusters_table.query({
        IndexName: 'subnet_mgmt_ip-index',
        KeyConditionExpression: 'subnet_mgmt_ip = :subnet_mgmt_ip',
        ExpressionAttributeValues: {
            ":subnet_mgmt_ip": {S: subnet + ':' + clusterIp}
        }
    }, function (err, data) {
        onQueryResponse(err, data);
    });
};

exports.createCluster = function (userUuid, region, vpc, subnet, clusterIp, userName, password, onCreateResponse) {
    console.log('Put item in table ' + clusters_table.config.params.TableName + ' - user uuid=' + userUuid + ', region=' + region + ', vpc=' + vpc + ', subnet=' + subnet + ', cluster ip=' + clusterIp + ', user name=' + userName + ', password=' + password);

    var item = {
        Item: {
            user_uuid: {S: userUuid},
            subnet_mgmt_ip: {S: subnet + ':' + clusterIp},
            region: {S: region},
            vpc: {S: vpc},
            subnet: {S: subnet},
            cluster_ip: {S: clusterIp},
            user_name: {S: userName},
            password: {S: password}
        }
    };

    clusters_table.putItem(item, function (err, data) {
        onCreateResponse(err, data);
    });
};
///// END CLUSTERS /////

///// AGENTS /////
var agents_table = new AWS.DynamoDB({params: {TableName: 'agents'}});

exports.createAgent = function (userUuid, region, vpc, subnet, onCreateResponse) {
    console.log('Put item in table ' + agents_table.config.params.TableName + ' - user uui=' + userUuid + ', region=' + region + ', vpc=' + vpc + ', subnet=' + subnet);

    var item = {
        Item: {
            user_uuid: {S: userUuid},
            region: {S: region},
            vpc: {S: vpc},
            subnet: {S: subnet},
            agent_status: {S: 'initializing'}
        }
    };

    agents_table.putItem(item, function (err, data) {
        onCreateResponse(err, data);
    });
};

exports.queryAgentByUserUuidAndSubnet = function (userUuid, subnet, onQueryResponse) {
    console.log('Query table ' + agents_table.config.params.TableName + ' by user uuid=' + userUuid + ', subnet=' + subnet);

    agents_table.query({
        KeyConditionExpression: 'user_uuid = :user_uuid AND subnet = :subnet',
        ExpressionAttributeValues: {
            ":user_uuid": {S: userUuid},
            ":subnet": {S: subnet}
        }
    }, function (err, data) {
        onQueryResponse(err, data);
    });
};

exports.queryAgentBySubnet = function (subnet, onQueryResponse) {
    console.log('Query table ' + agents_table.config.params.TableName + ' by subnet=' + subnet);

    agents_table.query({
        IndexName: 'subnet-index',
        KeyConditionExpression: 'subnet = :subnet',
        ExpressionAttributeValues: {
            ":subnet": {S: subnet}
        }
    }, function (err, data) {
        onQueryResponse(err, data);
    });
};

exports.updateAgent = function (userUuid, subnet, instance, status, onUpdateResponse) {
    console.log('Update item in table ' + agents_table.config.params.TableName + ' - user uuid=' + userUuid + ', subnet=' + subnet + ', instance=' + instance + ', status=' + status);

    agents_table.updateItem({
        "Key": {
            "user_uuid": {S: userUuid},
            "subnet": {S: subnet}
        },
        "UpdateExpression": "SET instance = :instance, agent_status = :agent_status",
        "ExpressionAttributeValues": {
            ":instance": {S: instance},
            ":agent_status": {S: status}
        }
    }, function (err, data) {
        onUpdateResponse(err, data);
    });
};
///// END AGENTS /////

///// EXPORTS /////
var exports_table = new AWS.DynamoDB({params: {TableName: 'exports'}});

exports.queryExportsByUserUuidAndSubnetAndIp = function (userUuid, subnet, clusterIp, onQueryResponse) {
    console.log('Query table ' + exports_table.config.params.TableName + ' by user uuid=' + userUuid + ', subnet=' + subnet + ', cluster ip=' + clusterIp);

    exports_table.query({
        KeyConditionExpression: 'user_uuid = :user_uuid AND subnet_mgmt_ip = :subnet_mgmt_ip',
        ExpressionAttributeValues: {
            ":user_uuid": {S: userUuid},
            ":subnet_mgmt_ip": {S: subnet + ':' + clusterIp}
        }
    }, function (err, data) {
        onQueryResponse(err, data);
    });
};

exports.queryExportsBySubnetAndIp = function (subnet, clusterIp, onQueryResponse) {
    console.log('Query table ' + exports_table.config.params.TableName + ' by subnet=' + subnet + ', cluster ip=' + clusterIp);

    exports_table.query({
        IndexName: 'subnet_mgmt_ip-index',
        KeyConditionExpression: 'subnet_mgmt_ip = :subnet_mgmt_ip',
        ExpressionAttributeValues: {
            ":subnet_mgmt_ip": {S: subnet + ':' + clusterIp}
        }
    }, function (err, data) {
        onQueryResponse(err, data);
    });
};

exports.updateExports = function (userUuid, subnet, clusterIp, exports, onUpdateResponse) {
    console.log('Update item in table ' + exports_table.config.params.TableName + ' - user uuid=' + userUuid + ', subnet=' + subnet + ', cluster ip=' + clusterIp + ', exports=' + exports);

    exports_table.updateItem({
        "Key": {
            "user_uuid": {S: userUuid},
            "subnet_mgmt_ip": {S: subnet + ':' + clusterIp}
        },
        "UpdateExpression": "SET exports = :exports",
        "ExpressionAttributeValues": {
            ":exports": {S: JSON.stringify(exports)}
        }
    }, function (err, data) {
        onUpdateResponse(err, data);
    });
};
///// END EXPORTS /////

///// COPY CONFIGURATION /////
var copy_configuration_table = new AWS.DynamoDB({params: {TableName: 'copy_configuration'}});

exports.queryCopyConfigurationByUserUuidAndSubnet = function (userUuid, subnet, onQueryResponse) {
    console.log('Query table ' + copy_configuration_table.config.params.TableName + ' by user uuid=' + userUuid + ', subnet=' + subnet);

    copy_configuration_table.query({
        KeyConditionExpression: 'user_uuid = :user_uuid AND subnet = :subnet',
        ExpressionAttributeValues: {
            ":user_uuid": {S: userUuid},
            ":subnet": {S: subnet}
        }
    }, function (err, data) {
        onQueryResponse(err, data);
    });
};

exports.queryCopyConfigurationBySubnetAndId = function (subnet, id, onQueryResponse) {
    console.log('Query table ' + copy_configuration_table.config.params.TableName + ' by subnet=' + subnet + ', id=' + subnet);

    copy_configuration_table.query({
        KeyConditionExpression: 'subnet = :subnet',
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: {
            ":subnet": {S: subnet},
            ":id": {S: id}
        }
    }, function (err, data) {
        onQueryResponse(err, data);
    });
};

exports.createCopyConfiguration = function (userUuid, subnet, source, target, id, onCreateResponse) {
    console.log('Put item in table ' + copy_configuration_table.config.params.TableName + ' - user uuid=' + userUuid + ', subnet=' + subnet + ', source=' + source + ', target=' + target);

    var item = {
        Item: {
            user_uuid: {S: userUuid},
            subnet: {S: subnet},
            source: {S: source},
            target: {S: target},
            copy_status: {S: 'not initialized'},
            id: {S: id}
        }
    };

    copy_configuration_table.putItem(item, function (err, data) {
        onCreateResponse(err, data);
    });
};

exports.updateCopyConfiguration = function (userUuid, subnet, id, status, onUpdateResponse) {
    console.log('Update item in table ' + copy_configuration_table.config.params.TableName + ' - user uuid=' + userUuid + ', subnet=' + subnet + ', id=' + id + ', status=' + status);

    copy_configuration_table.updateItem({
        "Key": {
            "user_uuid": {S: userUuid},
            "subnet_mgmt_ip": {S: subnet}
        },
        "UpdateExpression": "SET copy_status = :copy_status",
        "ConditionExpression": "id = :id",
        "ExpressionAttributeValues": {
            ":copy_status": {S: status},
            ":id": {S: id}
        }
    }, function (err, data) {
        onUpdateResponse(err, data);
    });
};
///// END COPY CONFIGURATION /////


exports.errorHandler = function (errorObj, callback) {
    console.log(JSON.stringify(errorObj, null, 2));
    callback(errorObj, null);
};

exports.uuid = function () {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}
