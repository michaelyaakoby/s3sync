#/bin/bash

rm -f /opt/NetApp/xFiles/xcp/license
cp -f /xcp-license.xwic /opt/NetApp/xFiles/xcp/license
rm -rf /catalog/*

xcp diag -rmrf s3://tlv-results
xcp diag -rmrf s3://tlv-marketing-results
xcp diag -rmrf s3://tlv-analytics
xcp diag -rmrf s3://tlv-qa
