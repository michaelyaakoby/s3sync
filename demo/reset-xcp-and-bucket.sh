#/bin/bash

rm -rf /catalog/*

xcp diag -rmrf s3://ontap-sync
xcp diag -rmrf s3://ontap-sync-standard
xcp diag -rmrf s3://tami-bucket
xcp diag -rmrf s3://qa-bucket1
xcp diag -rmrf s3://marketing-results
xcp diag -rmrf s3://analytics-bucket
