#!/usr/bin/python

import requests

instanceId = requests.get("http://169.254.169.254/latest/meta-data/instance-id").text
region = requests.get("http://169.254.169.254/latest/meta-data/placement/availability-zone").text[:-1]
nicMac = requests.get("http://169.254.169.254/latest/meta-data/network/interfaces/macs").text
subnet = requests.get("http://169.254.169.254/latest/meta-data/network/interfaces/macs/" + nicMac + "/subnet-id").text
