#/bin/bash

nps=192.168.2.98
bucket=ontap-sync-standard

if [ ! -f "/bin/aws" ]
then
  yum install -y unzip
  curl "https://s3.amazonaws.com/aws-cli/awscli-bundle.zip" -o "awscli-bundle.zip"
  unzip awscli-bundle.zip
  ./awscli-bundle/install -i /usr/local/aws -b /usr/local/bin/aws
  ln -s /usr/local/bin/aws /bin/aws
fi

mkdir /logs
mount $nps:/logs /logs

time aws s3 cp /logs s3://ontap-sync-standard --recursive --exclude ".snapshot/*"

echo now try: time xcp copy -newid x55 192.168.2.98:/logs s3://ontap-sync
