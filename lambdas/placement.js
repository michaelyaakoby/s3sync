var common = require('./common');

// Returns user's placements - regions, vpcs, subnets
// receives the following parameters:
// user-uuid
exports.handler = common.eventHandler(
    function (event, user) {
        var awsAccessKey = user.aws_access_key.S;
        var awsSecretKey = user.aws_secret_key.S;

        // #1 get all region names
        return common.describeRegionNames(awsAccessKey, awsSecretKey)

            // #2 get all subents for each region in parallel
            .map(function (regionName) {

                // 2.1 describe all subnets for region
                return common.describeSubnets(awsAccessKey, awsSecretKey, regionName)

                    // 2.2 format each subnet response
                    .then(function (subnetsData) {
                        return Object.keys(subnetsData.Subnets).map(function(key){
                            var subnet = subnetsData.Subnets[key];

                            return {
                                region: regionName,
                                vpcId: subnet.VpcId,
                                subnetId: subnet.SubnetId,
                                cidrBlock: subnet.CidrBlock,
                                tags: subnet.Tags
                            };
                        });
                    });
            })

            // #3 return the flattened results
            .then(function (arrayOfSubnets) {
                return common.flatten(arrayOfSubnets);
            });
    }
);

