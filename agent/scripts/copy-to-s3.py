#!/usr/bin/python

import os
import sys
import getopt
import metadata
import re
import tempfile

def usage():
  print "Usage: " + sys.argv[0] + " --copy-id <copy-session-id> --source-nfs-url <nfs://source-ip/path> --target-s3-url <s3://bucket/path> [--refresh] [--sns-topic <sns-topic-arn>]"
  sys.exit(2)

try:
  opts, args = getopt.getopt(sys.argv[1:], "c:s:t:rn:", ["copy-id=", "source-nfs-url=", "target-s3-url=", "refres", "sns-topic="])
except getopt.GetoptError:
  usage()

copyId = sourceNfsUrl = targetS3Url = snsTopic = None
refresh = False

for opt, arg in opts:
  if opt in ("-c", "--copy-id"):
    copyId = arg
  if opt in ("-s", "--source-nfs-url"):
    sourceNfsUrl = arg
  elif opt in ("-t", "--target-s3-url"):
    targetS3Url = arg
  elif opt in ("-r", "--refresh"):
    refresh = true
  elif opt in ("-n", "--sns-topic"):
    snsTopic = arg

if sourceNfsUrl is None or targetS3Url is None or copyId is None:
  usage()

nfsPattern = re.compile('nfs://([^/]+)(.*)')
(nfsAddress, nfsPath) = nfsPattern.match(sourceNfsUrl).groups()
nfsSource = nfsAddress + ":" + nfsPath 
print "NFS Source: " + nfsSource

mountDir = tempfile.mkdtemp(dir = "/tmp")
os.system("mount " + nfsSource + " " + mountDir + " -o nolock")
print "Mounted on: " + mountDir

print "Starting to copy to: " + targetS3Url
os.system("s3cmd sync " + mountDir + " " + targetS3Url + " --exclude '.snapshot/*'")
print "Copy completed"

os.system("umount " + mountDir)
os.rmdir(mountDir)
print "Unmounted from: " + mountDir

if snsTopic is not None:
  os.system("aws sns publish --region " + metadata.region + " --topic-arn " + snsTopic + " --subject copy-to-s3 --message '{\"copy-id\": \"" + copyId + "\", \"instance-id\": \"" + metadata.instanceId + "\", \"subnet-id\": \"" + metadata.subnet +"\", \"copy-completed\": { \"source\": \"" + sourceNfsUrl + "\", \"destination\": \"" + targetS3Url + "\" }}'")
