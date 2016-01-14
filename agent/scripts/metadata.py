#!/usr/bin/python

import requests
import re

instanceId = requests.get("http://169.254.169.254/latest/meta-data/instance-id").text
region = requests.get("http://169.254.169.254/latest/meta-data/placement/availability-zone").text[:-1]
nicMac = requests.get("http://169.254.169.254/latest/meta-data/network/interfaces/macs").text
subnetId = requests.get("http://169.254.169.254/latest/meta-data/network/interfaces/macs/" + nicMac + "/subnet-id").text
vpcId = requests.get("http://169.254.169.254/latest/meta-data/network/interfaces/macs/" + nicMac + "/vpc-id").text

def toNfsPath(nfsUrl):
  nfsPattern = re.compile('nfs://([^/]+)(.*)')
  match = nfsPattern.match(nfsUrl)
  
  if match is None:
    raise Exception('Bad NFS URL: ' + nfsUrl)
  
  (nfsAddress, nfsPath) = match.groups()
  return nfsAddress + ":" + nfsPath

