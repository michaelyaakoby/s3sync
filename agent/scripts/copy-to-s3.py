#!/usr/bin/python

import os
import sys
import getopt
import metadata
import boto3

def usage():
  print "Usage: " + sys.argv[0] + " --copy-id <copy-session-id> --source-nfs-url <nfs://source-ip/path> --target-s3-url <s3://bucket/path> [--sns-topic <sns-topic-arn>]"
  sys.exit(2)

try:
  opts, args = getopt.getopt(sys.argv[1:], "c:s:t:n:", ["copy-id=", "source-nfs-url=", "target-s3-url=", "sns-topic="])
except getopt.GetoptError:
  usage()

copyId = sourceNfsUrl = targetS3Url = snsTopic = None

for opt, arg in opts:
  if opt in ("-c", "--copy-id"):
    copyId = arg
  if opt in ("-s", "--source-nfs-url"):
    sourceNfsUrl = arg
  elif opt in ("-t", "--target-s3-url"):
    targetS3Url = arg
  elif opt in ("-n", "--sns-topic"):
    snsTopic = arg

if sourceNfsUrl is None or targetS3Url is None or copyId is None:
  usage()

if os.path.exists('/catalog/catalog/indexes/' + copyId):
  print "Starting incremental copy to: " + targetS3Url
  os.system("xcp sync -id " + copyId)
else:
  print "Starting basling copy to: " + targetS3Url
  os.system("xcp copy -newid " + copyId + " " + metadata.toNfsPath(sourceNfsUrl) + " " + targetS3Url)
print "Copy completed"

if snsTopic is not None:
  boto3.client('sns').publish(
    TopicArn=snsTopic, 
    Subject='copy-to-s3', 
    Message='{"copy-id": "' + copyId + '", "instance-id": "' + metadata.instanceId + '", "subnet-id": "' + metadata.subnetId + '", "copy-completed": { "source": "' + sourceNfsUrl + '", "destination": "' + targetS3Url + '"}}'
  )
