#!/usr/bin/python

import subprocess
import os
import sys
import getopt
import metadata

def usage():
  print "Usage: " + sys.argv[0] + " --copy-id <copy-session-id> --source-nfs-url <nfs://source-ip/path> --target-s3-url <s3://bucket/path> [--sns-topic <sns-topic-arn>] [--aws-access-key-id <access-key> --aws-secret-access-key <secret-key>]"
  sys.exit(2)

try:
  opts, args = getopt.getopt(sys.argv[1:], "c:s:t:n:i:a", ["copy-id=", "source-nfs-url=", "target-s3-url=", "sns-topic=", "aws-access-key-id=", "aws-secret-access-key="])
except getopt.GetoptError:
  usage()

copyId = sourceNfsUrl = targetS3Url = snsTopic = awsAccessKeyId = awsSecretAccessKey = None

for opt, arg in opts:
  if opt in ("-c", "--copy-id"):
    copyId = arg
  if opt in ("-s", "--source-nfs-url"):
    sourceNfsUrl = arg
  elif opt in ("-t", "--target-s3-url"):
    targetS3Url = arg
  elif opt in ("-n", "--sns-topic"):
    snsTopic = arg
  elif opt in ("-i", "--aws-access-key-id"):
    awsAccessKeyId = arg
  elif opt in ("-a", "--aws-secret-access-key"):
    awsSecretAccessKey = arg

if sourceNfsUrl is None or targetS3Url is None or copyId is None:
  usage()

try:
  xcpCmd = "xcp diag -run /opt/NetApp/s3sync/agent/scripts/xcp-progress.py"
  xcpEnv = dict(os.environ, **{'COPY_ID': copyId, 'INSTANCE_ID': metadata.instanceId, 'SUBNET_ID': metadata.subnetId, 'SNS_TOPIC': snsTopic})
  if awsAccessKeyId is not None and awsSecretAccessKey is not None:
    print "Using the provided AWS keys"
    xcpEnv = dict(xcpEnv, **{"AWS_ACCESS_KEY_ID": awsAccessKeyId, "AWS_SECRET_ACCESS_KEY": awsSecretAccessKey})

  if os.path.exists('/catalog/catalog/indexes/' + copyId):
    print "Starting incremental copy to: " + targetS3Url
    p = subprocess.Popen(xcpCmd + " sync -id " + copyId, env = xcpEnv, shell = True)
  else:
    print "Starting baseling copy to: " + targetS3Url
    p = subprocess.Popen(xcpCmd + " copy -newid " + copyId + " " + metadata.toNfsPath(sourceNfsUrl) + " " + targetS3Url, env = xcpEnv, shell = True)
  
  if p.wait() != 0:
    raise Exception("xcp failed, see previous messages for details")
  
  print "Copy completed"
  
except Exception as e: 
  metadata.snsNotify(snsTopic, 'copy-to-s3', {'copy-id': copyId, 'instance-id': metadata.instanceId, 'subnet-id': metadata.subnetId, 'failed': str(e)})
  raise

metadata.snsNotify(snsTopic, 'copy-to-s3', {'copy-id': copyId, 'instance-id': metadata.instanceId, 'subnet-id': metadata.subnetId, 'copy-completed': { 'source': sourceNfsUrl, 'destination': targetS3Url}})
