#/bin/bash

rm -f /opt/NetApp/xFiles/xcp/license
cp -f /xcp-license.xwic /opt/NetApp/xFiles/xcp/license
rm -rf /catalog/*

python -c "import boto3; c = boto3.client('sns').publish(TopicArn='arn:aws:sns:us-west-2:718273455463:occmservice', Subject='reset-demo', Message='{}')"

xcp diag -rmrf s3://tlv-results
xcp diag -rmrf s3://tlv-marketing-results
xcp diag -rmrf s3://tlv-analytics
xcp diag -rmrf s3://tlv-qa
