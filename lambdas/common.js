var AWS = require('aws-sdk');
var Promise = require('bluebird');
var http = require('https');

exports.sns_topic = 'arn:aws:sns:us-west-2:718273455463:occmservice';

///// USERS /////
function getUsersTable() {
    return new AWS.DynamoDB({params: {TableName: 'users'}});
}

var validateAndGetUser = function (uuid) {
    return exports.queryUserByUuid(uuid)
        // #2 - validate user exists
        .then(function (usersData) {
            if (!usersData.Count) {
                throw new UnauthorizedError();
            } else {
                return usersData.Items[0];
            }
        });
};

exports.queryUserByEmail = function (email) {
    var users_table = getUsersTable();
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

exports.queryUserByUuid = function (user_uuid) {
    var users_table = getUsersTable();
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

exports.createUser = function (user_uuid, email, password, name, awsAccessKey, awsSecretKey) {
    var users_table = getUsersTable();
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
    var users_table = getUsersTable();
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
function getClustersTable() {
    return new AWS.DynamoDB({params: {TableName: 'clusters'}});
}

exports.queryClustersByUserUuid = function (userUuid) {
    var clusters_table = getClustersTable();
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

exports.queryClustersBySubnetAndIp = function (subnet, clusterIp) {
    var clusters_table = getClustersTable();
    return promisify(
        'Query table ' + clusters_table.config.params.TableName + ' by subnet=' + subnet + ', cluster ip=' + clusterIp,
        clusters_table.query.bind(clusters_table, {
            IndexName: 'subnet_mgmt_ip-index',
            KeyConditionExpression: 'subnet_mgmt_ip = :subnet_mgmt_ip',
            ExpressionAttributeValues: {
                ":subnet_mgmt_ip": {S: subnet + ':' + clusterIp}
            }
        })
    );
};

exports.createCluster = function (userUuid, region, subnet, clusterIp, userName, password, clusterType) {
    var clusters_table = getClustersTable();
    return promisify(
        'Put item in table ' + clusters_table.config.params.TableName + ' - user uuid=' + userUuid + ', region=' + region + ', subnet=' + subnet + ', cluster ip=' + clusterIp + ', user name=' + userName + ', password=' + password + ', cluster type=' + clusterType,
        clusters_table.putItem.bind(clusters_table, {
            Item: {
                user_uuid: {S: userUuid},
                subnet_mgmt_ip: {S: subnet + ':' + clusterIp},
                region: {S: region},
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
function getAgentsTable() {
    return new AWS.DynamoDB({params: {TableName: 'agents'}});
}

exports.createAgent = function (userUuid, region, subnet) {
    var agents_table = getAgentsTable();
    return promisify(
        'Put item in table ' + agents_table.config.params.TableName + ' - user uui=' + userUuid + ', region=' + region + ', subnet=' + subnet,
        agents_table.putItem.bind(agents_table, {
            Item: {
                user_uuid: {S: userUuid},
                region: {S: region},
                subnet: {S: subnet}
            }
        })
    );
};

exports.queryAgentByUserUuidAndSubnet = function (userUuid, subnet) {
    var agents_table = getAgentsTable();
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

exports.queryAgentBySubnet = function (subnet) {
    var agents_table = getAgentsTable();
    return promisify(
        'Query table ' + agents_table.config.params.TableName + ' by subnet=' + subnet,
        agents_table.query.bind(agents_table, {
            IndexName: 'subnet-index',
            KeyConditionExpression: 'subnet = :subnet',
            ExpressionAttributeValues: {
                ":subnet": {S: subnet}
            }
        })
    );
};

exports.updateAgent = function (userUuid, subnet, instance) {
    var agents_table = getAgentsTable();
    return promisify(
        'Update item in table ' + agents_table.config.params.TableName + ' - user uuid=' + userUuid + ', subnet=' + subnet + ', instance=' + instance,
        agents_table.updateItem.bind(agents_table, {
            "Key": {
                "user_uuid": {S: userUuid},
                "subnet": {S: subnet}
            },
            "UpdateExpression": "SET instance = :instance",
            "ExpressionAttributeValues": {
                ":instance": {S: instance}
            }
        })
    );
};
///// END AGENTS /////

///// EXPORTS /////
function getExportsTable() {
    return new AWS.DynamoDB({params: {TableName: 'exports'}});
}

exports.queryExportsByUserUuidAndSubnetAndIp = function (userUuid, subnet, clusterIp) {
    var exports_table = getExportsTable();
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

exports.queryExportsBySubnetAndIp = function (subnet, clusterIp) {
    var exports_table = getExportsTable();
    return promisify(
        'Query table ' + exports_table.config.params.TableName + ' by subnet=' + subnet + ', cluster ip=' + clusterIp,
        exports_table.query.bind(exports_table, {
            IndexName: 'subnet_mgmt_ip-index',
            KeyConditionExpression: 'subnet_mgmt_ip = :subnet_mgmt_ip',
            ExpressionAttributeValues: {
                ":subnet_mgmt_ip": {S: subnet + ':' + clusterIp}
            }
        })
    );
};

exports.updateExports = function (userUuid, subnet, clusterIp, exports) {
    var exports_table = getExportsTable();
    return promisify(
        'Update item in table ' + exports_table.config.params.TableName + ' - user uuid=' + userUuid + ', subnet=' + subnet + ', cluster ip=' + clusterIp + ', exports=' + exports,
        exports_table.updateItem.bind(exports_table, {
            "Key": {
                "user_uuid": {S: userUuid},
                "subnet_mgmt_ip": {S: subnet + ':' + clusterIp}
            },
            "UpdateExpression": "SET exports = :exports",
            "ExpressionAttributeValues": {
                ":exports": {S: JSON.stringify(exports)}
            }
        })
    );
};
///// END EXPORTS /////

///// COPY CONFIGURATION /////
function getCopyConfigurationsTable() {
    return new AWS.DynamoDB({params: {TableName: 'copy_configuration'}});
}

exports.scanCopyConfigurationByCopyStatus = function (status) {
    var copy_configuration_table = getCopyConfigurationsTable();
    return promisify(
        'Scan table ' + copy_configuration_table.config.params.TableName + ' by user copy_status=' + status,
        copy_configuration_table.scan.bind(copy_configuration_table, {
            FilterExpression: 'copy_status = :copy_status',
            ExpressionAttributeValues: {
                ":copy_status": {S: status}
            }
        })
    );
};

exports.queryCopyConfigurationByUserUuidAndSubnet = function (userUuid, subnet) {
    var copy_configuration_table = getCopyConfigurationsTable();
    return promisify(
        'Query table ' + copy_configuration_table.config.params.TableName + ' by user uuid=' + userUuid + ', subnet=' + subnet,
        copy_configuration_table.query.bind(copy_configuration_table, {
            KeyConditionExpression: 'user_uuid = :user_uuid AND subnet = :subnet',
            ExpressionAttributeValues: {
                ":user_uuid": {S: userUuid},
                ":subnet": {S: subnet}
            }
        })
    );
};

exports.queryCopyConfigurationByUserUuid = function (userUuid) {
    var copy_configuration_table = getCopyConfigurationsTable();
    return promisify(
        'Query table ' + copy_configuration_table.config.params.TableName + ' by user uuid=' + userUuid,
        copy_configuration_table.query.bind(copy_configuration_table, {
            KeyConditionExpression: 'user_uuid = :user_uuid',
            ExpressionAttributeValues: {
                ":user_uuid": {S: userUuid}
            }
        })
    );
};

exports.queryCopyConfigurationBySubnetAndId = function (subnet, id) {
    var copy_configuration_table = getCopyConfigurationsTable();
    return promisify(
        'Query table ' + copy_configuration_table.config.params.TableName + ' by subnet=' + subnet + ', id=' + subnet,
        copy_configuration_table.query.bind(copy_configuration_table, {
            IndexName: 'subnet-index',
            KeyConditionExpression: 'subnet = :subnet',
            FilterExpression: 'id = :id',
            ExpressionAttributeValues: {
                ":subnet": {S: subnet},
                ":id": {S: id}
            }
        })
    );
};

exports.createCopyConfiguration = function (userUuid, subnet, source, target, id) {
    var copy_configuration_table = getCopyConfigurationsTable();
    return promisify(
        'Put item in table ' + copy_configuration_table.config.params.TableName + ' - user uuid=' + userUuid + ', subnet=' + subnet + ', source=' + source + ', target=' + target,
        copy_configuration_table.putItem.bind(copy_configuration_table, {
            Item: {
                user_uuid: {S: userUuid},
                subnet: {S: subnet},
                copy_source: {S: source},
                target: {S: target},
                copy_status: {S: 'not initialized'},
                id: {S: id}
            }
        })
    );
};

exports.updateCopyConfiguration = function (userUuid, subnet, id, status) {
    var copy_configuration_table = getCopyConfigurationsTable();
    return promisify(
        'Update item in table ' + copy_configuration_table.config.params.TableName + ' - user uuid=' + userUuid + ', subnet=' + subnet + ', id=' + id + ', status=' + status,
        copy_configuration_table.updateItem.bind(copy_configuration_table, {
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
        })
    );
};

exports.queryCopyConfigurationByUserUuidAndSubnetAndParams = function (userUuid, subnet, source, target) {
    var copy_configuration_table = getCopyConfigurationsTable();
    return promisify(
        'Query table ' + copy_configuration_table.config.params.TableName + ' by user uuid=' + userUuid + ', subnet=' + subnet + ', source=' + source + ', target=' + target,
        copy_configuration_table.query.bind(copy_configuration_table, {
            KeyConditionExpression: 'user_uuid = :user_uuid AND subnet = :subnet',
            FilterExpression: "copy_source = :copy_source AND target = :target",
            ExpressionAttributeValues: {
                ":user_uuid": {S: userUuid},
                ":subnet": {S: subnet},
                ":copy_source": {S: source},
                ":target": {S: target}
            }
        })
    );
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

function NotReadyError(message) {
    this.name = 'Not Ready';
    this.message = message;
}
NotReadyError.prototype = new Error();
exports.NotReadyError = NotReadyError;

function BadRequestError(message) {
    this.name = 'Bad Request';
    this.message = message;
}
BadRequestError.prototype = new Error();
exports.BadRequestError = BadRequestError;
///// END ERRORS /////

///// UTILS /////
exports.flatten = function (arrayOfArrays) {
    return arrayOfArrays.reduce(function (a, b) {
        return a.concat(b);
    });
};

function promisify(msg, fn) {
    console.log(msg);
    return new Promise(function (resolve, reject) {
        fn(function (err, data) {
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

exports.eventHandler = function (action, errorHandler) {
    return function (event, context) {
        console.log('Handling event - ', JSON.stringify(event));
        var initialPromise;
        if (action.length == 1) {
            initialPromise = action(event);
        } else {
            var userUuid = event['user-uuid'];
            initialPromise = validateAndGetUser(userUuid).then(function (user) {
                return action(event, user);
            });
        }
        initialPromise
            .then(function (data) {
                if (data) {
                    console.log('Succeeded event handling with response - ' + JSON.stringify(data));
                    context.succeed(data);
                } else {
                    console.log('Succeeded event handling with no response');
                    context.done();
                }
            })
            .catch(function (err) {
                console.log('Failed with internal error - ' + err);
                if (errorHandler) {
                    err = errorHandler(err);
                }
                if (err instanceof Error) {
                    err = {code: err.name, message: err.message};
                } else {
                    err = {code: 'Error', message: err};
                }
                err = JSON.stringify(err);
                console.log('Failed event handling with response - ' + err);
                context.fail(err);
            });
    };
};

exports.uuid = function () {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
};
///// END UTILS /////

///// EXECUTE SSM COMMAND /////
exports.executeCommand = function (region, instance, awsAccessKey, awsSecretKey, commandName, command) {
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
        .then(function (data) {
            return promisify(
                'Send command document - region=' + region + ', instance=' + instance + ', aws access key=' + awsAccessKey + ', aws secret key=' + awsSecretKey + ', command name=' + commandName + ', command=' + command,
                ssm.sendCommand.bind(ssm, {
                    DocumentName: documentName,
                    InstanceIds: [instance]
                })
            );
        })

        // #3 delete the SSM document and return the execute command result
        .then(function (executeCommandData) {
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
///// END EXECUTE SSM COMMAND /////

///// S3 /////
function getS3(awsAccessKey, awsSecretKey) {
    return new AWS.S3({
        accessKeyId: awsAccessKey,
        secretAccessKey: awsSecretKey
    });
}

exports.listBuckets = function (awsAccessKey, awsSecretKey) {
    var s3 = getS3(awsAccessKey, awsSecretKey);

    return promisify(
        'List buckets - aws access key=' + awsAccessKey + ', aws secret key=' + awsSecretKey,
        s3.listBuckets.bind(s3)
    )
};

///// END S3 /////

///// CLOUDWATCH /////
function getCloudWatch(awsAccessKey, awsSecretKey) {
    return new AWS.CloudWatch({
        accessKeyId: awsAccessKey,
        secretAccessKey: awsSecretKey
    });
}

exports.getBucketHourlyAverageMetricStats = function (awsAccessKey, awsSecretKey, bucketName, metricName, startTime, endTime) {
    var cw = getCloudWatch(awsAccessKey, awsSecretKey);

    return promisify(
        'Get bucket hourly average metric statistics - aws access key=' + awsAccessKey + ', aws secret key=' + awsSecretKey + ', bucketName=' + bucketName + ', metricName=' + metricName + ', startTime=' + startTime + ', endTime=' + endTime,
        cw.getMetricStatistics.bind(cw, {
            MetricName: metricName,
            Namespace: 'AWS/S3',
            Period: 3600,
            Statistics: ['Average'],
            StartTime: startTime,
            EndTime: endTime,
            Dimensions: [
                {
                    "Name": "BucketName",
                    "Value": bucketName
                },
                {
                    "Name": "StorageType",
                    "Value": "AllStorageTypes"
                }
            ]
        })
    )
};

///// END CLOUDWATCH /////

///// EC2 /////
function getEC2(awsAccessKey, awsSecretKey, region) {
    return new AWS.EC2({
        accessKeyId: awsAccessKey,
        secretAccessKey: awsSecretKey,
        region: region
    });
}

exports.describeSubnets = function (awsAccessKey, awsSecretKey, region, subnet) {
    var ec2 = getEC2(awsAccessKey, awsSecretKey, region);

    var funcWithCallback;
    if (subnet) {
        funcWithCallback = ec2.describeSubnets.bind(ec2, {
            SubnetIds: [subnet]
        });
    } else {
        funcWithCallback = ec2.describeSubnets.bind(ec2);
    }

    return promisify(
        'Describe subnets - aws access key=' + awsAccessKey + ', aws secret key=' + awsSecretKey + ', region=' + region + ', subnet=' + subnet,
        funcWithCallback
    )
};

exports.describeKeyPairs = function (awsAccessKey, awsSecretKey, region) {
    var ec2 = getEC2(awsAccessKey, awsSecretKey, region);

    return promisify(
        'Describe key pairs - aws access key=' + awsAccessKey + ', aws secret key=' + awsSecretKey + ', region=' + region,
        ec2.describeKeyPairs.bind(ec2)
    );
};

exports.describeRegionNames = function (awsAccessKey, awsSecretKey) {
    var ec2 = getEC2(awsAccessKey, awsSecretKey, undefined);

    return promisify(
        'Describe regions - aws access key=' + awsAccessKey + ', aws secret key=' + awsSecretKey,
        ec2.describeRegions.bind(ec2)
    )

        .then(function (data) {
            return Object.keys(data.Regions).map(function (key) {
                return data.Regions[key].RegionName;
            });
        });
};

exports.describeInstance = function (instanceId, awsAccessKey, awsSecretKey, region) {
    var ec2 = getEC2(awsAccessKey, awsSecretKey, region);

    return promisify(
        'Describe instance - instance id=' + instanceId + ', aws access key=' + awsAccessKey + ', aws secret key=' + awsSecretKey + ', region=' + region,
        ec2.describeInstances.bind(ec2, {
            InstanceIds: [instanceId]
        }))
        .then(function (data) {
            console.log(JSON.stringify(data));
            var instance = data.Reservations[0].Instances[0];
            return {
                instance: instance.InstanceId,
                region: region,
                state: instance.State
            };
        }, function () {
            return {
                instance: status.InstanceId,
                region: region,
                state: 'unknown'
            }
        });
};
///// END EC2 /////

///// GET URL CONTENT /////
exports.getUrlContent = function (host, port, path) {
    var httpGetWithCallback = function (callback) {
        var requestOptions = {
            method: 'GET',
            host: host,
            port: port,
            path: path
        };

        var requestCallback = function (response) {
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
exports.createCFStack = function (awsAccessKey, awsSecretKey, region, vpc, subnet, keypair, name, template) {
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
            Capabilities: ['CAPABILITY_IAM'],
            NotificationARNs: [exports.sns_topic],
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

