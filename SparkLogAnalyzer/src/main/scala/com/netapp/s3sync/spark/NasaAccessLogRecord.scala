package com.netapp.s3sync.spark

import java.util.regex.Pattern

// format specified at: http://ita.ee.lbl.gov/html/contrib/NASA-HTTP.html

object NasaAccessLogRecord {
  val LOG_ENTRY_PATTERN =
    // example:
    // in24.inetnebr.com - - [01/Aug/1995:00:00:01 -0400] "GET /shuttle/missions/sts-68/news/sts-68-mcc-05.txt HTTP/1.0" 200 1839
    //  1:client 2:date 3:method 4:req 5:proto 6:respcode 7:contsize
    """^(\S+) \S+ \S+ \[(.*)\] "(\S+) (\S+)\s*(\S*)" (\d{3}) (\S+)$"""

  val PATTERN = Pattern.compile(LOG_ENTRY_PATTERN)

  def apply(logLine: String): NasaAccessLogRecord = {
    val m = PATTERN.matcher(logLine)
    if (!m.matches()) {
      new NasaAccessLogRecord(isValid = false, logLine)
    } else {
      new NasaAccessLogRecord(isValid = true, logLine, m.group(1), m.group(2), m.group(3), m.group(4), m.group(5), m.group(6).toInt, m.group(7).replace('-', '0').toInt)
    }
  }
}

case class NasaAccessLogRecord(isValid: Boolean, original: String = "", clientIpOrHost: String = "", dateTime: String = "", method: String = "", endpoint: String = "", protocol: String = "", responseCode: Int = -1, contentSize: Int = -1)
