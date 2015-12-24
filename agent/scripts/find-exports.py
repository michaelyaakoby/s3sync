#!/usr/bin/python

import os
import sys
import requests
import xml.etree.ElementTree as ET
import getopt
import json
import metadata

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

ns = {'na': 'http://www.netapp.com/filer/admin'}

def findNaElement(node, *elements): 
  xpath = '/'.join(["na:" + x for x in elements])
  elem = node.find(xpath, ns)
  if elem == None:
    return None
  else:
    return elem.text

def zapiPost(xmlRequest):  
  httpResponse = requests.post('http://' + address + '/servlets/netapp.servlets.admin.XMLrequest_filer', auth=(username, password), data=xmlRequest) 
  if httpResponse.status_code != 200:
    raise IOError("Request failed " + str(httpResponse.status_code) + ": " + httpResponse.text)
  xmlResponse = ET.fromstring(httpResponse.text)
  if xmlResponse.find('na:results', ns).attrib['status'] == "failed":
    raise IOError("Request failed: " + xmlResponse.find('na:results', ns).attrib['reason'])
  return xmlResponse

def xmlToVolume(xmlVol): 
  return {
    'name':                      findNaElement(xmlVol, 'volume-id-attributes', 'name'),
	'svm':                       findNaElement(xmlVol, 'volume-id-attributes', 'owning-vserver-name'),
	'junction-path':             findNaElement(xmlVol, 'volume-id-attributes', 'junction-path'),
    'aggregate':                 findNaElement(xmlVol, 'volume-id-attributes', 'containing-aggregate-name'),
    'size-bytes':                findNaElement(xmlVol, 'volume-space-attributes', 'size'),
    'size-used-bytes':           findNaElement(xmlVol, 'volume-space-attributes', 'size-used'),
    'state':                     findNaElement(xmlVol, 'volume-state-attributes', 'state'),
    'is-vserver-root':           findNaElement(xmlVol, 'volume-state-attributes', 'is-vserver-root'),
    'export-policy':             findNaElement(xmlVol, 'volume-export-attributes', 'policy'),
    'parent-volume':             findNaElement(xmlVol, 'volume-clone-attributes', 'volume-clone-parent-attributes', 'name')
    }

volumesXml = zapiPost('<netapp  xmlns="http://www.netapp.com/filer/admin" version="1.20"> <volume-get-iter> <desired-attributes> <volume-attributes> <volume-id-attributes> <name/> <owning-vserver-name/> <containing-aggregate-name/> <junction-path/> </volume-id-attributes> <volume-space-attributes> <size/> <size-used/> </volume-space-attributes><volume-state-attributes> <is-vserver-root/> <state/> </volume-state-attributes> <volume-clone-attributes> <volume-clone-parent-attributes> <name/> </volume-clone-parent-attributes> </volume-clone-attributes> <volume-export-attributes> <policy/> </volume-export-attributes> </volume-attributes> </desired-attributes> </volume-get-iter> </netapp>')
volumes = map(xmlToVolume, volumesXml.findall('na:results/na:attributes-list/na:volume-attributes', ns))
print '------- Volumes ---------'
print volumes

def xmlToLif(xmlLif):
  return {
    'name':      findNaElement(xmlLif, 'interface-name'),
    'address':   findNaElement(xmlLif, 'address'),
    'status':    findNaElement(xmlLif, 'operational-status'),
    'protocols': findNaElement(xmlLif, 'data-protocols', 'data-protocol'),
    'svm':       findNaElement(xmlLif, 'vserver'),
    'role':      findNaElement(xmlLif, 'role')
  }

lifsXml = zapiPost('<netapp xmlns="http://www.netapp.com/filer/admin" version="1.20"><net-interface-get-iter><desired-attributes><net-interface-info><address/><data-protocols><data-protocol/></data-protocols><interface-name/><operational-status/><vserver/><role/></net-interface-info></desired-attributes></net-interface-get-iter></netapp>')
lifs = map(xmlToLif, lifsXml.findall('na:results/na:attributes-list/na:net-interface-info', ns))
print '------- LIFs ---------'
print lifs

nfsDataLifs = filter(lambda lif: lif['role'] == 'data' and 'nfs' in lif['protocols'], lifs)
svmToNfsLifAddress = dict([(x['svm'], x['address']) for x in nfsDataLifs])
nfsVolumes = filter(lambda vol: vol['svm'] in svmToNfsLifAddress, volumes)
exports = map(lambda vol: dict(vol, **{'data-lif-address': svmToNfsLifAddress[vol['svm']]}), nfsVolumes)

print '------- Exports ---------'
print exports

if snsTopic is not None:
  jsonExports = json.dumps(exports)
  os.system("aws sns publish --region " + metadata.region + " --topic-arn " + snsTopic + " --subject find-exports --message '{\"instance-id\": \"" + metadata.instanceId + "\", \"find-exports\": { \"cluster-mgmt-ip\": \"" + metadata.address + "\", \"subnet-id\": \"" + metadata.subnet +"\", \"exports\": " + jsonExports + " }}'")
