<?xml version="1.0"?>
<xsl:stylesheet version="3.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:fn="http://www.w3.org/2005/xpath-functions"
                exclude-result-prefixes="fn">
    <xsl:template match="/">
        <location><xsl:value-of select="fn:document-uri()"/></location>
    </xsl:template>
</xsl:stylesheet>
