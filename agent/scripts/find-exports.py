#!/usr/bin/python

import sys
import getopt
import metadata
import exports
import json

def usage():
  print "Usage: " + sys.argv[0] + " --address <ontap-cluster> --user <admin-user-name> --password <admin-password> [--sns-topic <sns-topic-arn>]"
  sys.exit(2)

try:
  opts, args = getopt.getopt(sys.argv[1:], "a:u:p:s:", ["address=", "user=", "password=", "sns-topic="])
except getopt.GetoptError:
  usage()

address = userName = password = snsTopic = None

for opt, arg in opts:
  if opt in ("-a", "--address"):
    address = arg
  elif opt in ("-u", "--user"):
    username = arg
  elif opt in ("-p", "--password"):
    password = arg
  elif opt in ("-s", "--sns-topic"):
    snsTopic = arg

if address is None or username is None or password is None:
  usage()

def measureExport(export):
  nfsAddress = export['data-lif-address']
  nfsPath = export['junction-path']
  nfsUrl = 'nfs://' + nfsAddress + nfsPath
  measurement = exports.measureExport(nfsUrl)
  metadata.snsNotify(snsTopic, 'find-exports-details', {'instance-id': metadata.instanceId, 'find-exports': { 'cluster-mgmt-ip': address, 'subnet-id': metadata.subnetId, 'export-nfs-url': nfsUrl, 'nfs-address': nfsAddress, 'nfs-path': nfsPath, 'size-bytes': measurement['size-bytes'], 'file-count': measurement['file-count']}})
  return measurement

try:
  foundExports = exports.findExports(address, username, password)
  print 'Exports >>> ' +  str(foundExports)
  
  metadata.snsNotify(snsTopic, 'find-exports', {'instance-id': metadata.instanceId, 'find-exports': { 'cluster-mgmt-ip': address, 'subnet-id': metadata.subnetId, 'exports': foundExports}})
  for export in foundExports:
    print 'Measured >> ' + str(measureExport(export))

except Exception as e: 
  metadata.snsNotify(snsTopic, 'find-exports', {'instance-id': metadata.instanceId, 'failed': str(e)})
  raise
