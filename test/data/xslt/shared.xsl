<?xml version="1.0"?>
<xsl:stylesheet version="2.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:fn="http://www.w3.org/2005/xpath-functions"
                xmlns:xs="http://www.w3.org/2001/XMLSchema"
                xmlns:foo="foo"
                exclude-result-prefixes="fn">
    <xsl:function name="foo:bar" as="xs:integer">
        <xsl:param name="x" as="xs:integer"/>
        <xsl:value-of select="$x * 2"/>
    </xsl:function>
</xsl:stylesheet>
