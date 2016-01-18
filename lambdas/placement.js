var common = require('./common');

// Returns user's placements - regions, vpcs, subnets
// receives the following parameters:
// authorization
exports.handler = common.eventHandler(
    function (event, user) {
        // #1 get all region names
        return common.describeRegionNames(user.awsAccessKey, user.awsSecretKey)

            // #2 get all subents for each region in parallel
            .map(function (regionName) {

                // 2.1 describe all subnets for region
                return common.describeSubnets(user.awsAccessKey, user.awsSecretKey, regionName)

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

