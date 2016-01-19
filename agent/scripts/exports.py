#!/usr/bin/python

import sys
import getopt
import metadata
import subprocess
import requests
import xml.etree.ElementTree as ET

def measureExport(nfsUrl, requestId = None, snsTopic = None):
  scanResult = subprocess.check_output("xcp scan -q -csv " + metadata.toNfsPath(nfsUrl), shell=True)
  
  for row in scanResult.splitlines():
    tokens = row.split(',')
    if len(tokens) == 2:
        if tokens[0] == 'Total space used': totalSpace = tokens[1]
        if tokens[0] == 'Total count': totalCount = tokens[1]
    
  metadata.snsNotify(snsTopic, 'measure-export', {'request-id': requestId, 'instance-id': metadata.instanceId, 'subnet-id': metadata.subnetId, 'measure-export': { 'total-file-and-dirs-count': totalCount, 'total-size-in-bytes': totalSpace}})
  
  return {'nfsUrl': nfsUrl, 'size-bytes': totalSpace, 'file-count': totalCount}

ns = {'na': 'http://www.netapp.com/filer/admin'}

def findNaElement(node, *elements): 
  xpath = '/'.join(["na:" + x for x in elements])
  elem = node.find(xpath, ns)
  if elem == None:
    return None
  else:
    return elem.text

def zapiPost(address, username, password, xmlRequest):  
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

def xmlToLif(xmlLif):
  return {
    'name':      findNaElement(xmlLif, 'interface-name'),
    'address':   findNaElement(xmlLif, 'address'),
    'status':    findNaElement(xmlLif, 'operational-status'),
    'protocols': findNaElement(xmlLif, 'data-protocols', 'data-protocol'),
    'svm':       findNaElement(xmlLif, 'vserver'),
    'role':      findNaElement(xmlLif, 'role')
  }

def findExports(address, username, password):
  volumesXml = zapiPost(address, username, password, '<netapp  xmlns="http://www.netapp.com/filer/admin" version="1.20"> <volume-get-iter> <desired-attributes> <volume-attributes> <volume-id-attributes> <name/> <owning-vserver-name/> <containing-aggregate-name/> <junction-path/> </volume-id-attributes> <volume-space-attributes> <size/> <size-used/> </volume-space-attributes><volume-state-attributes> <is-vserver-root/> <state/> </volume-state-attributes> <volume-clone-attributes> <volume-clone-parent-attributes> <name/> </volume-clone-parent-attributes> </volume-clone-attributes> <volume-export-attributes> <policy/> </volume-export-attributes> </volume-attributes> </desired-attributes> </volume-get-iter> </netapp>')
  volumes = map(xmlToVolume, volumesXml.findall('na:results/na:attributes-list/na:volume-attributes', ns))
  print 'Volumes >>> ' + str(volumes)
  
  lifsXml = zapiPost(address, username, password, '<netapp xmlns="http://www.netapp.com/filer/admin" version="1.20"><net-interface-get-iter><desired-attributes><net-interface-info><address/><data-protocols><data-protocol/></data-protocols><interface-name/><operational-status/><vserver/><role/></net-interface-info></desired-attributes></net-interface-get-iter></netapp>')
  lifs = map(xmlToLif, lifsXml.findall('na:results/na:attributes-list/na:net-interface-info', ns))
  print 'LIFs >>> ' + str(lifs)
  
  nfsDataLifs = filter(lambda lif: lif['role'] == 'data' and 'nfs' in lif['protocols'], lifs)
  svmToNfsLifAddress = dict([(x['svm'], x['address']) for x in nfsDataLifs])
  nfsVolumes = filter(lambda vol: vol['svm'] in svmToNfsLifAddress, volumes)
  return map(lambda vol: dict(vol, **{'data-lif-address': svmToNfsLifAddress[vol['svm']]}), nfsVolumes)

