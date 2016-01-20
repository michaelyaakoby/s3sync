##
# pre.py
#
# Copyright (c) 2016, NetApp Inc.
#
# HISTORY
# Jan  15, 2012      Peter Schay        Created
#

import sys
import time

import xcp
import sched

import os
import boto.sns
import re
import json

# == scan/copy/resume/sync/verify(*)
# SNSTask just polls the scheduler until it finds the task with the rd.Tree
# With a scan/copy/resume/sync there is only one Tree which has the stats
# needed for tracking progress
#
# == verify -stats ==
# In the case of verify -stats there are 2 tasks with trees because it
# parallel scans the source and target.  (With regular verify, there is
# just the source tree being scanned and the target being verified does
# not have a task or Tree)
#
# == sync ==
# It will take some thought to come up with a good progress tracker for sync
# In the case of sync, there are a couple phases before it dives into a
# regular scan-and-copy that has a Tree.  First, the source is checked for
# changes.  While that happens, regular file removes are done on the target.
# Next phase is to handle renames and moves (will be painful with s3) and
# also remove directories bottom-up since you cannot remove non-empty dirs
# Finally, dive into the regular copy which has a tree

# Stat polling frequency
Frequency = 7

copyId = os.environ['COPY_ID']
instanceId = os.environ['INSTANCE_ID']
subnetId = os.environ['SUBNET_ID']
snsTopic = os.environ['SNS_TOPIC']
region = re.compile('arn:aws:sns:([^:]+):.*').match(snsTopic).group(1)
conn = boto.sns.connect_to_region(region)

class SNSTask(sched.SimpleTask):
	def gRun(self):

		treeTask = None
		while treeTask is None:
			for task in self.engine.tasks.values():
				if hasattr(task, "tree"):
					treeTask = task
					break
			yield (time.time() + .1, None)

		while True:
			yield (time.time() + Frequency, None)
			
			# Get number of regular files copied so far
			filesCopiedSoFar = treeTask.tree.stats['copied']
			
			# Get bytes copied so far (from regular files)
			bytesCopiedSoFar = treeTask.tree.stats['dataCopied']
			
			conn.publish(topic = snsTopic, subject = 'copy-to-s3-progress', message = json.dumps({'copy-id': copyId, 'instance-id': instanceId, 'subnet-id': subnetId, 'progress': {'files-copied-so-far': filesCopiedSoFar, 'bytes-copied-so-far': bytesCopiedSoFar }}))


# xcp diag -run show.py will call this function
def run(argv):
	engine = sched.engine

	SNSTask()
	xcp.xcp(argv, engine=engine, warn=False)
	sys.exit(0)
