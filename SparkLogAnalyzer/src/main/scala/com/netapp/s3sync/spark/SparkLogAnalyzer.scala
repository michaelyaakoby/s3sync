package com.netapp.s3sync.spark

import java.io.ByteArrayInputStream
import java.nio.charset.StandardCharsets
import java.text.DecimalFormat

import com.amazonaws.auth.InstanceProfileCredentialsProvider
import com.amazonaws.regions.Regions
import com.amazonaws.services.s3.AmazonS3Client
import com.amazonaws.services.s3.model.{ListObjectsRequest, ObjectMetadata, PutObjectRequest}
import com.amazonaws.services.sns.AmazonSNSClient
import org.apache.spark.SparkConf
import org.apache.spark.api.java.JavaSparkContext
import org.apache.spark.rdd.RDD

import scala.collection.JavaConverters._
object SparkLogAnalyzer {

  def main(args: Array[String]) = {
    val startTime = System.currentTimeMillis()

    val inputBucketArgument = args(0)
    val outputBucketArgument = args(1)
    val jobId = args(2)
    val snsTopic = args(3)

    val outputBucket = outputBucketArgument.replace("s3://", "")

    // Create a Spark Context.
    val conf = new SparkConf().setAppName("Log Analyzer")
    val sc = new JavaSparkContext(conf)

/*
    // read input files into RDD as per: http://tech.kinja.com/how-not-to-pull-from-s3-using-apache-spark-1704509219 and https://gist.github.com/snowindy/d438cb5256f9331f5eec
    val (inputBucket, inputBucketPrefix) = splitToS3BucketAndPrefix(args(0))
    val (outputBucket, outputBucketPrefix) = splitToS3BucketAndPrefix(args(1))

    var logRdd: RDD[String] = sc.emptyRDD[String]
    @transient val request = new ListObjectsRequest(inputBucket, inputBucketPrefix, null, null, null)
    @transient var listing = s3.listObjects(request)
    var proceed = true
    while (proceed){
      if (listing.getObjectSummaries.isEmpty) {
        proceed = false
      } else {
        val data = listing.getObjectSummaries.asScala
        @transient val s3FileKeys = data.map(_.getKey).toList
        def decoder = Codec.UTF8.decoder.onMalformedInput(CodingErrorAction.IGNORE)
        val inputLines = sc.parallelize(s3FileKeys).flatMap { key => Source.fromInputStream(s3.getObject(inputBucket, key).getObjectContent: InputStream)(decoder).getLines() }
        logRdd = logRdd.union(inputLines)
        listing = s3.listNextBatchOfObjects(listing)
      }
    }
*/
/*
    val s3FilesKeys = getAllObjectKeys(s3, new ListObjectsRequest(inputBucket, inputBucketPrefix, null, null, null)).toList
    val logRdd = sc.parallelize(s3FilesKeys).flatMap { key => Source.fromInputStream(s3.getObject(inputBucket, key).getObjectContent).getLines() }
*/
    val logRdd: RDD[String] = sc.textFile(inputBucketArgument)

    // Convert the text log lines to NasaAccessLogRecord instances
    val logRecordsRdd = logRdd.map[NasaAccessLogRecord](NasaAccessLogRecord(_)).cache()
    val validLogRecordsRdd = logRecordsRdd.filter(_.isValid).cache()
    val invalidLogRecordsRdd = logRecordsRdd.filter(!_.isValid).cache()


    // Calculate total records data
    val formatter = new DecimalFormat("#.###")
    val totalRecords = logRecordsRdd.count()
    val totalValidRecords = validLogRecordsRdd.count()
    val totalValidRecordsPercent = formatter.format((totalValidRecords.toDouble / totalRecords.toDouble) * 100)
    val totalInvalidRecords = invalidLogRecordsRdd.count()
    val totalInvalidRecordsPercent = formatter.format((totalInvalidRecords.toDouble / totalRecords.toDouble) * 100)

    // Calculate content size basic statistics.
    val contentSizesRdd = validLogRecordsRdd.map(_.contentSize).cache()
    val minContentSize = contentSizesRdd.min()
    val avgContentSize = contentSizesRdd.reduce(_ + _) / totalRecords
    val maxContentSize = contentSizesRdd.max()

    // Calculate counts per response code in descending order
    val responseCodesCount = validLogRecordsRdd.map(r => (r.responseCode, 1)).reduceByKey(_ + _).sortBy(_._2, ascending = false).collect()

    // Calculate client's requests count in descending order
    val clientRequestsCount = logRecordsRdd.map(r => (r.clientIpOrHost, 1)).reduceByKey(_ + _).sortBy(_._2, ascending = false).collect()

    val invalidLogLines = invalidLogRecordsRdd.collect()

    // prepare the report
    val out = new StringBuilder
    out.append(s"Total execution time: ").append((System.currentTimeMillis() - startTime) / 1000).append("s\n\n")

    out.append(s"Total log records: $totalRecords\n")
      .append(s"Total valid log records: $totalValidRecords ($totalValidRecordsPercent%)\n")
      .append(s"Total invalid log records: $totalInvalidRecords ($totalInvalidRecordsPercent%)\n\n")

    out.append(s"Content size statistics:\n========================\n")
      .append(s"Min: $minContentSize, Avg: $avgContentSize, Max: $maxContentSize\n")
      .append("\n")

    out.append("Response codes count:\n=====================\n")
      .append("\t\tCode\t\tCount\n\t\t====\t\t=====\n")
    responseCodesCount.map { case (code, count) => s"\t\t$code\t\t\t$count\n" }.foreach(out.append)
    out.append("\n")

    out.append("Client requests count:\n======================\n")
      .append("\t\tCount\t\tClient\n\t\t=====\t\t======\n")
    clientRequestsCount.map {case (client, count) => s"\t\t$count\t\t$client\n" }.foreach(out.append)
    out.append("\n")

    out.append("Invalid log records:\n====================\n")
    invalidLogLines.map{l => s"\t\t${l.original}\n"}.foreach(out.append)
    out.append("\n")

    val report = out.toString()

    // print out the report and also save it to s3 destination
    //println(report)
    s3.putObject(new PutObjectRequest(outputBucket, jobId + "_results/" + "result.log", new ByteArrayInputStream(report.getBytes(StandardCharsets.UTF_8)), new ObjectMetadata()))

    // notify listeners we're done
    sns.publish(snsTopic, "{\"copy-id\": \"" + jobId + "\"  }", "EMR Completed")

    // shutdown spark
    sc.stop()
  }

  def getAllObjectKeys(s3: AmazonS3Client, request: ListObjectsRequest): Seq[String] = {
    val objectsList = s3.listObjects(request)
    val retrievedKeys = objectsList.getObjectSummaries.asScala.map(_.getKey).toSeq
    if (!objectsList.isTruncated) {
      retrievedKeys
    } else {
      request.setMarker(objectsList.getNextMarker)
      retrievedKeys ++ getAllObjectKeys(s3, request)
    }
  }

  def splitToS3BucketAndPrefix(s3Path: String) = {
    val parts = s3Path.replace("s3://", "").split("/")
    (parts.head, parts.tail.mkString("", "/", "/"))
  }

  def s3 = new AmazonS3Client(new InstanceProfileCredentialsProvider())

  def sns = {
    val s = new AmazonSNSClient(new InstanceProfileCredentialsProvider())
    s.setRegion(Regions.getCurrentRegion)
    s
  }

}
