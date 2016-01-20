#/bin/bash

nps=192.168.2.98
bucket=ontap-sync

exportfs localhost:/ -o ro,no_root_squash,async

echo '>>>>>> '
echo '>>>>>> Setting up volume: data1 '
echo '>>>>>> '
rm -rf data1
mkdir data1
find /usr/ -exec cp \{\} data1 \; 2>/dev/null
xcp diag -rmrf $nps:/data1
xcp copy -newid data1 localhost:`pwd`/data1 $nps:/data1

echo '>>>>>> '
echo '>>>>>> Setting up volume: data2'
echo '>>>>>> '
rm -rf data2
mkdir data2
find /lib/ -exec cp \{\} data2 \; 2>/dev/null
xcp diag -rmrf $nps:/data2
xcp copy -newid data2 localhost:`pwd`/data2 $nps:/data2

echo '>>>>>> '
echo '>>>>>> Setting up volume: logs'
echo '>>>>>> '
rm -rf logs
mkdir logs
find /var/log -exec cp \{\} logs \;
xcp diag -rmrf $nps:/logs
xcp copy -newid logs localhost:`pwd`/logs $nps:/logs

exportfs -u localhost:/

echo '>>>>>> '
echo '>>>>>> Setting EMR volume: access_logs'
echo '>>>>>> '
curl ftp://ita.ee.lbl.gov/traces/NASA_access_log_Jul95.gz -o NASA_access_log_Jul95.gz
gunzip NASA_access_log_Aug95.gz
curl ftp://ita.ee.lbl.gov/traces/NASA_access_log_Aug95.gz -o NASA_access_log_Aug95.gz
gunzip NASA_access_log_Jul95.gz
mkdir emr
cd emr
split -l 500 --additional-suffix .log ../NASA_access_log_Jul95 access_Jul95_
split -l 500 --additional-suffix .log ../NASA_access_log_Aug95 access_Aug95_
exportfs localhost:`pwd`
xcp copy -newid emr localhost:`pwd` 192.168.2.98:/access_logs
exportfs -u localhost:`pwd`
