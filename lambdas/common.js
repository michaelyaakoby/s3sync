var AWS = require('aws-sdk');
var Promise = require('bluebird');
var http = require('https');

exports.sns_topic = 'arn:aws:sns:us-west-2:718273455463:occmservice';

///// USERS /////
var users_table = new AWS.DynamoDB({params: {TableName: 'users'}});

var validateAndGetUser = function(uuid) {
    return exports.queryUserByUuidP(uuid)
    // #2 - validate user exists
    .then(function (usersData) {
        if (!usersData.Count) {
            throw new UnauthorizedError();
        } else {
            return usersData.Items[0];
        }
    });
};
exports.validateAndGetUser = validateAndGetUser;

exports.queryUserByEmail = function (email) {
    return promisify(
        'Query table ' + users_table.config.params.TableName + ' by email=' + email,
        users_table.query.bind(users_table, {
            KeyConditionExpression: 'email = :email',
            ExpressionAttributeValues: {
                ":email": {S: email}
            }
        })
    )
};

exports.queryUserByUuidP = function (user_uuid) {
    return promisify(
        'Query table ' + users_table.config.params.TableName + ' by uuid=' + user_uuid,
        users_table.query.bind(users_table, {
            IndexName: 'user_uuid-index',
            KeyConditionExpression: 'user_uuid = :user_uuid',
            ExpressionAttributeValues: {
                ":user_uuid": {S: user_uuid}
            }
        })
    );
};

exports.queryUserByUuid = function (user_uuid, onQueryResponse) {
    console.log('Query table ' + users_table.config.params.TableName + ' by uuid=' + user_uuid);
    users_table.query({
        IndexName: 'user_uuid-index',
        KeyConditionExpression: 'user_uuid = :user_uuid',
        ExpressionAttributeValues: {
            ":user_uuid": {S: user_uuid}
        }
    }, onQueryResponse);
};

exports.createUser = function (user_uuid, email, password, name, awsAccessKey, awsSecretKey) {
    return promisify(
        'Put item in table ' + users_table.config.params.TableName + ' - uuid=' + user_uuid + ', email=' + email + ', password=' + password + ', name=' + name + ', aws access key=' + awsAccessKey + ', aws secret key=' + awsSecretKey,
        users_table.putItem.bind(users_table, {
            Item: {
                user_uuid: {S: user_uuid},
                email: {S: email},
                password: {S: password},
                name: {S: name},
                aws_access_key: {S: awsAccessKey},
                aws_secret_key: {S: awsSecretKey}
            }
        })
    );
};

exports.updateUserAwsCredentials = function (email, awsAccessKey, awsSecretKey) {
    return promisify(
        'Update item in table ' + users_table.config.params.TableName + ' - email=' + email + ', aws access key=' + awsAccessKey + ', aws secret key=' + awsSecretKey,
        users_table.updateItem.bind(users_table, {
            "Key": {
                "email": {S: email}
            },
            "UpdateExpression": "SET aws_access_key = :aws_access_key, aws_secret_key = :aws_secret_key",
            "ExpressionAttributeValues": {
                ":aws_access_key": {S: awsAccessKey},
                ":aws_secret_key": {S: awsSecretKey}
            }
        })
    );
};

///// END USERS /////

///// CLUSTERS /////
var clusters_table = new AWS.DynamoDB({params: {TableName: 'clusters'}});

exports.queryClustersByUserUuid = function (userUuid) {
    return promisify(
        'Query table ' + clusters_table.config.params.TableName + ' by user uuid=' + userUuid,
        clusters_table.query.bind(clusters_table, {
            KeyConditionExpression: 'user_uuid = :user_uuid',
            ExpressionAttributeValues: {
                ":user_uuid": {S: userUuid}
            }
        })
    );
};

exports.queryClustersBySubnetAndIp = function (subnet, clusterIp, onQueryResponse) {
    console.log('Query table ' + clusters_table.config.params.TableName + ' by subnet=' + subnet + ', cluster ip=' + clusterIp);
    clusters_table.query({
        IndexName: 'subnet_mgmt_ip-index',
        KeyConditionExpression: 'subnet_mgmt_ip = :subnet_mgmt_ip',
        ExpressionAttributeValues: {
            ":subnet_mgmt_ip": {S: subnet + ':' + clusterIp}
        }
    }, onQueryResponse);
};

exports.createCluster = function (userUuid, region, vpc, subnet, clusterIp, userName, password, clusterType) {
    return promisify(
        'Put item in table ' + clusters_table.config.params.TableName + ' - user uuid=' + userUuid + ', region=' + region + ', vpc=' + vpc + ', subnet=' + subnet + ', cluster ip=' + clusterIp + ', user name=' + userName + ', password=' + password + ', cluster type=' + clusterType,
        clusters_table.putItem.bind(clusters_table, {
            Item: {
                user_uuid: {S: userUuid},
                subnet_mgmt_ip: {S: subnet + ':' + clusterIp},
                region: {S: region},
                vpc: {S: vpc},
                subnet: {S: subnet},
                cluster_ip: {S: clusterIp},
                user_name: {S: userName},
                password: {S: password},
                cluster_type: {S: clusterType}
            }
        })
    );
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

    agents_table.putItem(item, onCreateResponse);
};

exports.queryAgentByUserUuidAndSubnetP = function (userUuid, subnet) {
    return promisify(
        'Query table ' + agents_table.config.params.TableName + ' by user uuid=' + userUuid + ', subnet=' + subnet,
        agents_table.query.bind(agents_table, {
            KeyConditionExpression: 'user_uuid = :user_uuid AND subnet = :subnet',
            ExpressionAttributeValues: {
                ":user_uuid": {S: userUuid},
                ":subnet": {S: subnet}
            }
        })
    );
};

exports.queryAgentByUserUuidAndSubnet = function (userUuid, subnet, onQueryResponse) {
    console.log('Query table ' + agents_table.config.params.TableName + ' by user uuid=' + userUuid + ', subnet=' + subnet);

    agents_table.query({
        KeyConditionExpression: 'user_uuid = :user_uuid AND subnet = :subnet',
        ExpressionAttributeValues: {
            ":user_uuid": {S: userUuid},
            ":subnet": {S: subnet}
        }
    }, onQueryResponse);
};

exports.queryAgentBySubnet = function (subnet, onQueryResponse) {
    console.log('Query table ' + agents_table.config.params.TableName + ' by subnet=' + subnet);

    agents_table.query({
        IndexName: 'subnet-index',
        KeyConditionExpression: 'subnet = :subnet',
        ExpressionAttributeValues: {
            ":subnet": {S: subnet}
        }
    }, onQueryResponse);
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
    }, onUpdateResponse);
};
///// END AGENTS /////

///// EXPORTS /////
var exports_table = new AWS.DynamoDB({params: {TableName: 'exports'}});

exports.queryExportsByUserUuidAndSubnetAndIp = function (userUuid, subnet, clusterIp) {
    return promisify(
        'Query table ' + exports_table.config.params.TableName + ' by user uuid=' + userUuid + ', subnet=' + subnet + ', cluster ip=' + clusterIp,
        exports_table.query.bind(exports_table, {
            KeyConditionExpression: 'user_uuid = :user_uuid AND subnet_mgmt_ip = :subnet_mgmt_ip',
            ExpressionAttributeValues: {
                ":user_uuid": {S: userUuid},
                ":subnet_mgmt_ip": {S: subnet + ':' + clusterIp}
            }
        })
    );
};

exports.queryExportsBySubnetAndIp = function (subnet, clusterIp, onQueryResponse) {
    console.log('Query table ' + exports_table.config.params.TableName + ' by subnet=' + subnet + ', cluster ip=' + clusterIp);

    exports_table.query({
        IndexName: 'subnet_mgmt_ip-index',
        KeyConditionExpression: 'subnet_mgmt_ip = :subnet_mgmt_ip',
        ExpressionAttributeValues: {
            ":subnet_mgmt_ip": {S: subnet + ':' + clusterIp}
        }
    }, onQueryResponse);
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
    }, onUpdateResponse);
};
///// END EXPORTS /////

///// COPY CONFIGURATION /////
var copy_configuration_table = new AWS.DynamoDB({params: {TableName: 'copy_configuration'}});

exports.scanCopyConfigurationByCopyStatus = function(status, onQueryResponse) {
    console.log('Scan table ' + copy_configuration_table.config.params.TableName + ' by user copy_status=' + status);

    copy_configuration_table.scan({
        FilterExpression: 'copy_status = :copy_status',
        ExpressionAttributeValues: {
            ":copy_status": {S: status}
        }
    }, onQueryResponse);
};

exports.queryCopyConfigurationByUserUuidAndSubnet = function (userUuid, subnet, onQueryResponse) {
    console.log('Query table ' + copy_configuration_table.config.params.TableName + ' by user uuid=' + userUuid + ', subnet=' + subnet);

    copy_configuration_table.query({
        KeyConditionExpression: 'user_uuid = :user_uuid AND subnet = :subnet',
        ExpressionAttributeValues: {
            ":user_uuid": {S: userUuid},
            ":subnet": {S: subnet}
        }
    }, onQueryResponse);
};

exports.queryCopyConfigurationBySubnetAndId = function (subnet, id, onQueryResponse) {
    console.log('Query table ' + copy_configuration_table.config.params.TableName + ' by subnet=' + subnet + ', id=' + subnet);

    copy_configuration_table.query({
        IndexName: 'subnet-index',
        KeyConditionExpression: 'subnet = :subnet',
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: {
            ":subnet": {S: subnet},
            ":id": {S: id}
        }
    }, onQueryResponse);
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

    copy_configuration_table.putItem(item, onCreateResponse);
};

exports.updateCopyConfiguration = function (userUuid, subnet, id, status, onUpdateResponse) {
    console.log('Update item in table ' + copy_configuration_table.config.params.TableName + ' - user uuid=' + userUuid + ', subnet=' + subnet + ', id=' + id + ', status=' + status);

    copy_configuration_table.updateItem({
        "Key": {
            "user_uuid": {S: userUuid},
            "subnet": {S: subnet}
        },
        "UpdateExpression": "SET copy_status = :copy_status",
        "ConditionExpression": "id = :id",
        "ExpressionAttributeValues": {
            ":copy_status": {S: status},
            ":id": {S: id}
        }
    }, onUpdateResponse);
};
///// END COPY CONFIGURATION /////

///// ERRORS /////
function UnauthorizedError() {
    this.name = 'Unauthorized';
    this.message = 'Invalid credentials';
}
UnauthorizedError.prototype = new Error();
exports.UnauthorizedError = UnauthorizedError;

function NotFoundError(message) {
    this.name = 'Not Found';
    this.message = message;
}
NotFoundError.prototype = new Error();
exports.NotFoundError = NotFoundError;

function BadRequestError(message) {
    this.name = 'Bad Request';
    this.message = message;
}
BadRequestError.prototype = new Error();
exports.BadRequestError = BadRequestError;
///// END ERRORS /////

///// UTILS /////
function promisify(msg, fn) {
    console.log(msg);
    return new Promise(function (resolve, reject) {
        fn(function(err, data) {
            if (err) {
                var errMsg = 'Failed ' + msg + ': ' + err;
                console.log(errMsg);
                reject(new Error(errMsg))
            } else {
                console.log('Succeeded ' + msg + ': ' + JSON.stringify(data));
                resolve(data);
            }
        });
    });
}

exports.eventHandler = function(action, errorHandler) {
    return function (event, context) {
        console.log('Handling event - ', JSON.stringify(event));
        var initialPromise;
        if (action.length == 1) {
            initialPromise = action(event);
        } else {
            var userUuid = event['user-uuid'];
            initialPromise = validateAndGetUser(userUuid).then(function (user) { return action(event, user); });
        }
        initialPromise
        .then(function (data) {
            console.log('Succeeded event handling with response - ' + JSON.stringify(data));
            context.succeed(data);
        })
        .catch(function (err) {
            console.log('Failed with internal error - ' + err);
            if (errorHandler) {
                err = errorHandler(err);
            }
            if (err instanceof Error) {
                err = { code: err.name, message: err.message };
            } else {
                err = { code: 'Error', message: err };
            }
            err = JSON.stringify(err);
            console.log('Failed event handling with response - ' + err);
            context.fail(err);
        });
    };
};

exports.errorHandler = function (callback, msg) {
    var error = {
        code: 'Error',
        message: msg
    };
    console.log(JSON.stringify(error, null, 2));
    callback(error, null);
};

exports.uuid = function () {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
};
///// END UTILS /////

///// EXECUTE SSM COMMAND /////
exports.executeCommandP = function (region, instance, awsAccessKey, awsSecretKey, commandName, command) {
    var ssm = new AWS.SSM({
        region: region,
        accessKeyId: awsAccessKey,
        secretAccessKey: awsSecretKey
    });
    var documentName = commandName + '_' + new Date().getTime();
    var documentContent = {
        schemaVersion: '1.2',
        description: commandName,
        parameters: {},
        runtimeConfig: {
            "aws:runShellScript": {
                properties: [{
                    id: '0.aws:runShellScript',
                    runCommand: [command]
                }]
            }
        }
    };

    // #1 create the SSM document
    return promisify(
        'Create command document - region=' + region + ', instance=' + instance + ', aws access key=' + awsAccessKey + ', aws secret key=' + awsSecretKey + ', command name=' + commandName + ', command=' + command,
        ssm.createDocument.bind(ssm, {
            Name: documentName,
            Content: JSON.stringify(documentContent)
        })
    )
        // #2 execute the SSM document
        .then(function(data) {
            return promisify(
                'Send command document - region=' + region + ', instance=' + instance + ', aws access key=' + awsAccessKey + ', aws secret key=' + awsSecretKey + ', command name=' + commandName + ', command=' + command,
                ssm.sendCommand.bind(ssm, {
                    DocumentName: documentName,
                    InstanceIds: [instance]
                })
            );
        })

        // #3 delete the SSM document and return the execute command result
        .then(function(executeCommandData) {
            return promisify(
                'Delete command document - region=' + region + ', instance=' + instance + ', aws access key=' + awsAccessKey + ', aws secret key=' + awsSecretKey + ', command name=' + commandName + ', command=' + command,
                ssm.deleteDocument.bind(ssm, {
                    Name: documentName
                })
            )
                .catch(function (err) {
                    console.log('recovering from delete command document');
                    return null;
                })
                .then(function (data) {
                    return executeCommandData;
                });
        });
};

exports.executeCommand = function (region, instance, awsAccessKey, awsSecretKey, commandName, command, onExecuteCommand) {
    console.log('Executing command - region=' + region + ', instance=' + instance + ', aws access key=' + awsAccessKey + ', aws secret key=' + awsSecretKey + ', command name=' + commandName + ', command=' + command);
    var options = {
        region: region,
        accessKeyId: awsAccessKey,
        secretAccessKey: awsSecretKey
    };
    var ssm = new AWS.SSM(options);

    var content = {
        schemaVersion: '1.2',
        description: commandName,
        parameters: {},
        runtimeConfig: {
            "aws:runShellScript": {
                properties: [{
                    id: '0.aws:runShellScript',
                    runCommand: [command]
                }]
            }
        }
    };

    var documentName = commandName + '_' + new Date().getTime();

    // create command
    ssm.createDocument({
        Name: documentName,
        Content: JSON.stringify(content)
    }, function (err, createDocumentData) {
        if (err) {
            console.log(err);
            onExecuteCommand({
                code: 'Error',
                message: 'Failed to to create document ' + documentName + ', ' + err
            }, null);
        } else {
            console.log('Document created');

            // send command
            ssm.sendCommand({
                DocumentName: documentName,
                InstanceIds: [instance]
            }, function (err, sendCommandData) {
                if (err) {
                    onExecuteCommand({
                        code: 'Error',
                        message: 'Failed to send command ' + documentName + ' , ' + err
                    }, null);
                } else {
                    console.log('Command executed');
                    // delete document
                    ssm.deleteDocument({
                        Name: documentName
                    }, function (err, deleteDocumentData) {
                        if (err) {
                            console.log(err);
                            onExecuteCommand({
                                code: 'Error',
                                message: 'Failed to delete document ' + documentName + ' , ' + err
                            }, null);
                        } else {
                            console.log('Document deleted');
                            onExecuteCommand(null, sendCommandData);
                        }
                    });
                }
            });
        }
    });

};
///// END EXECUTE SSM COMMAND /////

///// EC2 DESCRIBE SUBNET /////
exports.describeSubnet = function(awsAccessKey, awsSecretKey, region, subnet) {
    var ec2 = new AWS.EC2({
        accessKeyId: awsAccessKey,
        secretAccessKey: awsSecretKey,
        region: region
    });

    return promisify(
        'Describe subnet - aws access key=' + awsAccessKey + ', aws secret key=' + awsSecretKey + ', region=' + region + ', subnet=' + subnet,
        ec2.describeSubnets.bind(ec2, {
            SubnetIds: [ subnet ]
        })
    )
};
///// END EC2 DESCRIBE SUBNET /////

///// GET URL CONTENT /////
exports.getUrlContent = function(host, port, path) {
    var httpGetWithCallback = function(callback) {
        var requestOptions = {
            method: 'GET',
            host: host,
            port: port,
            path: path
        };

        var requestCallback = function(response) {
            var str = '';

            response.on('data', function (chunk) {
                str += chunk;
            });

            response.on('end', function () {
                callback(null, str);
            });
        };

        var request = http.request(requestOptions, requestCallback);

        request.end();

        request.on('error', function (e) {
           callback(e);
        });
    };

    return promisify(
        'Get URL Content - host=' + host + ', port=' + port + ', path=' + path,
        httpGetWithCallback
    );
};
///// END GET URL CONTENT /////

///// CREATE CF STACK /////
exports.createCFStack = function(awsAccessKey, awsSecretKey, region, vpc, subnet, keypair, name, template) {
    var cf = new AWS.CloudFormation({
        region: region,
        accessKeyId: awsAccessKey,
        secretAccessKey: awsSecretKey
    });

    return promisify(
        'Create CloudFormation Stack - aws access key=' + awsAccessKey + ', aws secret key=' + awsSecretKey + ', region=' + region + +' vpc=' + vpc + ', subnet=' + subnet + ' keypair=' + keypair + ', name=' + name + ', template=\n' + template,
        cf.createStack.bind(cf, {
            StackName: name + new Date().getTime(),
            TemplateBody: template,
            Capabilities: [ 'CAPABILITY_IAM' ],
            NotificationARNs: [ exports.sns_topic ],
            Parameters: [
                {
                    ParameterKey: 'VpcId',
                    ParameterValue: vpc
                },
                {
                    ParameterKey: 'SubnetId',
                    ParameterValue: subnet
                },
                {
                    ParameterKey: 'KeyPair',
                    ParameterValue: keypair
                }
            ]
        })
    );
};
///// END CREATE CF STACK /////

