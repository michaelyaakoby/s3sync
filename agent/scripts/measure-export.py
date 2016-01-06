#!/usr/bin/python

import os
import sys
import getopt
import metadata
import re

def usage():
  print "Usage: " + sys.argv[0] + " --nfs-url <nfs://source-ip/path> [--request-id <request-id> --sns-topic <sns-topic-arn>]"
  sys.exit(2)

try:
  opts, args = getopt.getopt(sys.argv[1:], "r:n:s:", ["request-id=", "nfs-url=", "sns-topic="])
except getopt.GetoptError:
  usage()

requestId = nfsUrl = snsTopic = None

for opt, arg in opts:
  if opt in ("-r", "--request-id"):
    requestId = arg
  if opt in ("-n", "--nfs-url"):
    nfsUrl = arg
  elif opt in ("-s", "--sns-topic"):
    snsTopic = arg

if nfsUrl is None:
  usage()

nfsPattern = re.compile('nfs://([^/]+)(.*)')
(nfsAddress, nfsPath) = nfsPattern.match(nfsUrl).groups()
nfsSource = nfsAddress + ":" + nfsPath
print "NFS to scan: " + nfsSource

import subprocess

scanResult = subprocess.check_output("xcp scan -q -csv " + nfsSource, shell=True)

for row in scanResult.splitlines():
  tokens = row.split(',')
  if len(tokens) == 2:
      if tokens[0] == 'Total space used': totalSpace = tokens[1]
      if tokens[0] == 'Total count': totalCount = tokens[1]

print("size-in-bytes: " + totalSpace)
print("count: " + totalCount)

if snsTopic is not None:
  os.system("aws sns publish --region " + metadata.region + " --topic-arn " + snsTopic + " --subject measure-export --message '{\"request-id\": \"" + requestId + "\", \"instance-id\": \"" + metadata.instanceId + "\", \"subnet-id\": \"" + metadata.subnet +"\", \"measure-export\": { \"total-file-and-dirs-count\": \"" + totalCount + "\", \"total-size-in-bytes\": \"" + totalSpace + "\" }}'")
