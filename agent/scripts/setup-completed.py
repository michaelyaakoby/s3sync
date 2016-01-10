#!/usr/bin/python

import boto3
import metadata
import getopt
import sys

def usage():
  print "Usage: " + sys.argv[0] + " --stack-name <stack-name> --sns-topic <sns-topic-arn>"
  sys.exit(2)

try:
  opts, args = getopt.getopt(sys.argv[1:], "s:t:", ["stack-name=", "sns-topic="])
except getopt.GetoptError:
  usage()

stackName = snsTopic = None

for opt, arg in opts:
  if opt in ("-a", "--stack-name"):
    stackName = arg
  elif opt in ("-s", "--sns-topic"):
    snsTopic = arg

if stackName is None or snsTopic is None:
  usage()

cfnClient = boto3.client('cloudformation')
cfnClient.signal_resource(
    StackName=stackName,
    LogicalResourceId='AgentInstance',
    UniqueId=metadata.instanceId,
    Status='SUCCESS'
)

snsClient = boto3.client('sns')
snsClient.publish(
    TopicArn=snsTopic, 
    Subject='deploy-agent-completed', 
    Message='{"deploy-agent": { "vpc-id": "' + metadata.vpcId + '", "subnet-id": "' + metadata.subnetId + '", "instance-id": "' + metadata.instanceId + '" }, "status": "success"}'
)
