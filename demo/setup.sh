#/bin/bash

nps=192.168.2.98

exportfs localhost:/ -o ro,no_root_squash,async
rm -rf /catalog/*

rm -rf data1
mkdir data1
find /usr/ -exec cp \{\} data1 \; 2>/dev/null
xcp diag -rmrf $nps:/data1
xcp copy -newid data1 localhost:`pwd`/data1 $nps:/data1

rm -rf data2
mkdir data2
find /lib/ -exec cp \{\} data2 \; 2>/dev/null
xcp diag -rmrf $nps:/data2
xcp copy -newid data2 localhost:`pwd`/data2 $nps:/data2

rm -rf logs
mkdir logs
find /var/log -exec cp \{\} logs \;
xcp diag -rmrf $nps:/logs
xcp copy -newid logs localhost:`pwd`/logs $nps:/logs

exportfs -u localhost:/
rm -rf /catalog/*
