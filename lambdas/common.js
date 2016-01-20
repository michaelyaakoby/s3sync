var AWS = require('aws-sdk');
var Promise = require('bluebird');
var jwt = require('jsonwebtoken');
var http = require('https');

exports.sns_topic = 'arn:aws:sns:us-west-2:718273455463:occmservice';

///// JWT /////
var jwtSecret = 'E3%c_mA~8^779}u';
var jwtIssuer = 'NetApp Inc.';

exports.jwtIssue = function(userId, expiresInMinutes) {
    var payload = {
        userId: userId
    };
    var options = {
        issuer: jwtIssuer
    };
    if (expiresInMinutes && expiresInMinutes > 0) {
        options.expiresInMinutes = expiresInMinutes;
    }
    return jwt.sign(payload, jwtSecret, options);
};

function jwtVerify(jwtToken) {
    return new Promise(function(resolve, reject) {
        if (!jwtToken) {
            reject(new UnauthorizedError());
        }
        jwtToken = removePrefixIfExists(jwtToken, 'bearer ');
        jwt.verify(jwtToken, jwtSecret, {}, function (error, payload) {
            if (error) {
                reject(error);
            } else {
                resolve(payload.userId);
            }
        })
    });
}

///// END JWT /////

///// USERS /////
function getUsersTable() {
    return new AWS.DynamoDB({params: {TableName: 'users'}});
}

var authenticateAndGetUser = function (event) {
    var jwtToken = removePrefixIfExists(event.Authorization, 'bearer ');
    return jwtVerify(jwtToken)
        .catch(function (error) {
            console.error('Failed verifying JWT token: ' + error);
            throw new UnauthorizedError();
        })
        .then(function (userId) {
            console.log('User id is: ' + userId);
            return exports.queryUserByUidWithExceptions(userId);
        })
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

exports.queryUserByUid = function (uid) {
    var users_table = getUsersTable();
    return promisify(
        'Query table ' + users_table.config.params.TableName + ' by uuid=' + uid,
        users_table.query.bind(users_table, {
            IndexName: 'user_uuid-index',
            KeyConditionExpression: 'user_uuid = :user_uuid',
            ExpressionAttributeValues: {
                ":user_uuid": {S: uid}
            }
        })
    );
};

exports.queryUserByUidWithExceptions = function (uid) {
    return exports.queryUserByUid(uid)

        .then(function (usersData) {
            if (!usersData.Count) {
                console.error('User data not found!');
                throw new UnauthorizedError();
            }
            var user = usersData.Items[0];
            if (isDynamoItemColumnUndefined(user.aws_access_key) || isDynamoItemColumnUndefined(user.aws_secret_key)) {
                throw new PreconditionFailedError('No AWS credentials')
            }
            return {
                uid: user.user_uuid.S,
                email: user.email.S,
                name: user.name.S,
                awsAccessKey: user.aws_access_key.S,
                awsSecretKey: user.aws_secret_key.S
            };
        });
};

exports.createUser = function (uid, name, email) {
    var users_table = getUsersTable();
    return promisify(
        'Put item in table ' + users_table.config.params.TableName + ' - uuid=' + uid + ', email=' + email + ', name=' + name,
        users_table.putItem.bind(users_table, {
            Item: {
                user_uuid: {S: uid},
                email: {S: email},
                name: {S: name}
            }
        })
    );
};

exports.updateUserAwsCredentials = function (uid, awsAccessKey, awsSecretKey) {
    var users_table = getUsersTable();
    return promisify(
        'Update item in table ' + users_table.config.params.TableName + ' - uuid=' + uid + ', aws access key=' + awsAccessKey + ', aws secret key=' + awsSecretKey,
        users_table.updateItem.bind(users_table, {
            "Key": {
                "user_uuid": {S: uid}
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

exports.queryClustersByUserUid = function (uid) {
    var clusters_table = getClustersTable();
    return promisify(
        'Query table ' + clusters_table.config.params.TableName + ' by user uuid=' + uid,
        clusters_table.query.bind(clusters_table, {
            KeyConditionExpression: 'user_uuid = :user_uuid',
            ExpressionAttributeValues: {
                ":user_uuid": {S: uid}
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

exports.queryAgentByUserUidAndSubnet = function (uid, subnet) {
    var agents_table = getAgentsTable();
    return promisify(
        'Query table ' + agents_table.config.params.TableName + ' by user uuid=' + uid + ', subnet=' + subnet,
        agents_table.query.bind(agents_table, {
            KeyConditionExpression: 'user_uuid = :user_uuid AND subnet = :subnet',
            ExpressionAttributeValues: {
                ":user_uuid": {S: uid},
                ":subnet": {S: subnet}
            }
        })
    );
};

exports.queryAgentByUserUid = function (uid) {
    var agents_table = getAgentsTable();
    return promisify(
        'Query table ' + agents_table.config.params.TableName + ' by user uuid=' + uid,
        agents_table.query.bind(agents_table, {
            KeyConditionExpression: 'user_uuid = :user_uuid',
            ExpressionAttributeValues: {
                ":user_uuid": {S: uid}
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

exports.queryCopyConfigurationById = function (id) {
    var copy_configuration_table = getCopyConfigurationsTable();
    return promisify(
        'Query table ' + copy_configuration_table.config.params.TableName + ' by id=' + id,
        copy_configuration_table.query.bind(copy_configuration_table, {
            IndexName: 'copy_id-index',
            KeyConditionExpression: 'copy_id = :copy_id',
            ExpressionAttributeValues: {
                ":copy_id": {S: id}
            }
        })
    );
};

exports.createCopyConfiguration = function (userUuid, id, source, target) {
    var copy_configuration_table = getCopyConfigurationsTable();
    return promisify(
        'Put item in table ' + copy_configuration_table.config.params.TableName + ' - user uuid=' + userUuid + ', id=' + id + ', source=' + source + ', target=' + target,
        copy_configuration_table.putItem.bind(copy_configuration_table, {
            Item: {
                user_uuid: {S: userUuid},
                copy_id: {S: id},
                copy_source: {S: source},
                target: {S: target},
                copy_status: {S: 'not initialized'}
            }
        })
    );
};

exports.updateCopyConfiguration = function (userUuid, id, status) {
    var copy_configuration_table = getCopyConfigurationsTable();
    return promisify(
        'Update item in table ' + copy_configuration_table.config.params.TableName + ' - user uuid=' + userUuid + ', id=' + id + ', status=' + status,
        copy_configuration_table.updateItem.bind(copy_configuration_table, {
            "Key": {
                "user_uuid": {S: userUuid},
                "copy_id": {S: id}
            },
            "UpdateExpression": "SET copy_status = :copy_status",
            "ExpressionAttributeValues": {
                ":copy_status": {S: status}
            }
        })
    );
};

exports.queryCopyConfigurationByUserUuidAndParams = function (userUuid, source, target) {
    var copy_configuration_table = getCopyConfigurationsTable();
    return promisify(
        'Query table ' + copy_configuration_table.config.params.TableName + ' by user uuid=' + userUuid + ', source=' + source + ', target=' + target,
        copy_configuration_table.query.bind(copy_configuration_table, {
            KeyConditionExpression: 'user_uuid = :user_uuid',
            FilterExpression: "copy_source = :copy_source AND target = :target",
            ExpressionAttributeValues: {
                ":user_uuid": {S: userUuid},
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

function PreconditionFailedError(message) {
    this.name = 'Precondition Failed';
    this.message = message;
}
PreconditionFailedError.prototype = new Error();
exports.PreconditionFailedError = PreconditionFailedError;
///// END ERRORS /////

///// UTILS /////
function removePrefixIfExists(str, prefix) {
    if (!str || (str.length < prefix.length)) {
        return str;
    }
    var strPrefix = str.substr(0, prefix.length).toLowerCase();
    if (strPrefix == prefix.toLowerCase()) {
        return str.substr(prefix.length);
    } else {
        return str;
    }
}

exports.flatten = function (arrayOfArrays) {
    return arrayOfArrays.reduce(function (a, b) {
        return a.concat(b);
    });
};

function isDynamoItemColumnUndefined(column) {
    return !column || !column.S || column.S == '';
}
exports.isDynamoItemColumnUndefined = isDynamoItemColumnUndefined;

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
            initialPromise = authenticateAndGetUser(event).then(function (user) {
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
                    context.succeed();
                }
            })
            .catch(function (err) {
                console.error('Failed with internal error - ', err);
                if (errorHandler) {
                    err = errorHandler(err);
                }
                if (!(err instanceof Error)) {
                    console.warn('Only Error types should be thrown, but ' + typeof(err) + ' was thrown with value: ' + err);
                    err = new Error(err);
                }
                console.error('Failed event handling with response - ', err);
                context.fail(err.name + ' - ' + err.message);
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
    var documentName = commandName + '_' + exports.uuid();
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
    );
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
exports.getUrlContent = function (host, port, path, headers) {
    var httpGetWithCallback = function (callback) {
        var requestOptions = {
            method: 'GET',
            host: host,
            port: port,
            path: path
        };

        if (headers) {
            requestOptions.headers = headers;
        }

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

exports.getAmazonProfile = function(accessToken) {
    console.log('Get amazon profile - accessToken=' + accessToken);
    return exports.getUrlContent('api.amazon.com', 443, '/user/profile', { 'Authorization': 'Bearer ' + accessToken })
        .then(function (data) {
            var profile = JSON.parse(data);
            if (profile.error) {
                console.error("Failed Get amazon profile - " + data);
                throw new UnauthorizedError();
            } else {
                console.error("Succeeded Get amazon profile - profile: " + data);
                return profile;
            }
        });
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

///// INVOKE LAMBDA /////
exports.invokeLambda = function (functionName, payload) {
    var lambda = new AWS.Lambda();

    return promisify(
        'Invoke lambda - function name=' + functionName + ', payload=' + JSON.stringify(payload),
        lambda.invoke.bind(lambda, {
            FunctionName: functionName,
            InvocationType: 'Event',
            Payload: JSON.stringify(payload)
        })
    )
};
///// END INVOKE LAMBDA /////

///// SEND SNS /////
exports.publishMessage = function (message, subject, topic) {
    var sns = new AWS.SNS();

    return promisify(
        'Publish notification - message=' + JSON.stringify(message) + ', subject=' + subject + ', topic=' + topic,
        sns.publish.bind(sns, {
            Message: JSON.stringify(message),
            Subject: subject,
            TopicArn: topic
        })
    )
};
///// EBD SEND SNS /////


