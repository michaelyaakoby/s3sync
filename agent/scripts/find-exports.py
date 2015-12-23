#!/usr/bin/python

import sys
import requests
import xml.etree.ElementTree as ET
import getopt

def usage():
  print "Usage: " + sys.argv[0] + " --address <ontap-cluster> --user <admin-user-name> --password <admin-password>"
  sys.exit(2)

try:
  opts, args = getopt.getopt(sys.argv[1:], "a:u:p:", ["address=", "user=", "password="])
except getopt.GetoptError:
  usage()

address = userName = password = None

for opt, arg in opts:
  if opt in ("-a", "--address"):
    address = arg
  elif opt in ("-u", "--user"):
    username = arg
  elif opt in ("-p", "--password"):
    password = arg

if address is None or username is None or password is None:
  usage()

volumesResponse = requests.post('http://' + address + '/servlets/netapp.servlets.admin.XMLrequest_filer', auth=(username, password), data='<netapp  xmlns="http://www.netapp.com/filer/admin" version="1.20"> <volume-get-iter> <desired-attributes> <volume-attributes> <volume-id-attributes> <name/> <owning-vserver-name/> <containing-aggregate-name/> <junction-path/> </volume-id-attributes> <volume-space-attributes> <size/> <size-used/> </volume-space-attributes><volume-state-attributes> <is-vserver-root/> <state/> </volume-state-attributes> <volume-clone-attributes> <volume-clone-parent-attributes> <name/> </volume-clone-parent-attributes> </volume-clone-attributes> <volume-export-attributes> <policy/> </volume-export-attributes> </volume-attributes> </desired-attributes> </volume-get-iter> </netapp>') 
volumesXml = ET.fromstring(volumesResponse.text)

ns = {'na': 'http://www.netapp.com/filer/admin'}

def findNaElement(node, group, element): 
  elem = node.find('na:'+group+'/na:'+element, ns)
  if elem == None:
    return None
  else:
    return elem.text

def xmlToVolume(vol): 
  return {
    'name':                      findNaElement(vol, 'volume-id-attributes', 'name'),
	'svm':                       findNaElement(vol, 'volume-id-attributes', 'owning-vserver-name'),
	'junction-path':             findNaElement(vol, 'volume-id-attributes', 'junction-path'),
    'aggregate':                 findNaElement(vol, 'volume-id-attributes', 'containing-aggregate-name'),
    'size-bytes':                findNaElement(vol, 'volume-space-attributes', 'size'),
    'size-used-bytes':           findNaElement(vol, 'volume-space-attributes', 'size-used'),
    'state':                     findNaElement(vol, 'volume-state-attributes', 'state'),
    'is-vserver-root':           findNaElement(vol, 'volume-state-attributes', 'is-vserver-root'),
    'export-policy':             findNaElement(vol, 'volume-export-attributes', 'policy'),
    'parent-volume':             findNaElement(vol, 'volume-clone-attributes/na:volume-clone-parent-attributes', 'name')
    }

volumes = map(xmlToVolume, volumesXml.findall('na:results/na:attributes-list/na:volume-attributes', ns))

print volumes
