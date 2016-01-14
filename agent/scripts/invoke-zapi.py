#!/usr/bin/python

import sys
import requests
import xml.etree.ElementTree as ET
import getopt
import json
import metadata
import boto3


def usage():
  print "Usage: " + sys.argv[0] + " --address <ontap-cluster> --user <admin-user-name> --password <admin-password> --request <zapi-request-xml> [--request-id <request-id> --sns-topic <sns-topic-arn>]"
  sys.exit(2)

try:
  opts, args = getopt.getopt(sys.argv[1:], "r:a:u:p:z:s:", ["request-id=", "address=", "user=", "password=", "request=", "sns-topic="])
except getopt.GetoptError:
  usage()

requestId = address = userName = password = snsTopic = requestXml = None

for opt, arg in opts:
  if opt in ("-r", "--request-id"):
    requestId = arg
  if opt in ("-a", "--address"):
    address = arg
  elif opt in ("-u", "--user"):
    username = arg
  elif opt in ("-p", "--password"):
    password = arg
  elif opt in ("-z", "--request"):
    requestXml = arg
  elif opt in ("-s", "--sns-topic"):
    snsTopic = arg

if address is None or username is None or password is None or requestXml is None:
  usage()

ns = {'na': 'http://www.netapp.com/filer/admin'}

httpResponse = requests.post('http://' + address + '/servlets/netapp.servlets.admin.XMLrequest_filer', auth=(username, password), data=requestXml) 
if httpResponse.status_code != 200:
  raise IOError("Request failed " + str(httpResponse.status_code) + ": " + httpResponse.text)
responseText = httpResponse.text
responseXml = ET.fromstring(responseText)
if responseXml.find('na:results', ns).attrib['status'] == "failed":
  raise IOError("Request failed: " + responseXml.find('na:results', ns).attrib['reason'])

print '------- Response ---------'
print responseText

if snsTopic is not None:
  boto3.client('sns').publish(
    TopicArn=snsTopic, 
    Subject='invoke-zapi', 
    Message='{"request-id": "' + requestId + '", "instance-id": "' + metadata.instanceId + '", "invoke-zapi": { "cluster-mgmt-ip": "' + address + '", "subnet-id": "' + metadata.subnetId + '", "response": "' + responseText + '"}}'
  )
