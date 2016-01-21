import java.util.regex.Pattern

val LOG_ENTRY_PATTERN =
//  1:client 2:date 3:method 4:req 5:proto 6:respcode 7:contsize
  """^(\S+) \S+ \S+ \[(.*)\] "(\S+) (\S+)\s*(\S*)" (\d{3}) (\S+)$"""
//  """^(\S+) \S+ \S+ \[(.*)\] "(\S+) (\S+) (\S+)" (\d{3}) ((?:\d+)|\-)$"""

val PATTERN = Pattern.compile(LOG_ENTRY_PATTERN)

val string = """pipe1.nyc.pipeline.com - - [01/Aug/1995:00:12:37 -0400] "GET /history/apollo/apollo-13/apollo-13-patch-small.gif" 200 12859"""

val m = PATTERN.matcher(string)

m.matches()
m.group(1)
m.group(2)
m.group(3)
m.group(4)
m.group(5)
m.group(6)
m.group(7)