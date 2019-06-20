<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:fn="http://www.w3.org/2005/xpath-functions"
                version="3.0">
    <xsl:output method="text" media-type="text/json"/>

    <xsl:template match="/">
        <xsl:variable name="result">
            <fn:map>
                <fn:string key="message"><xsl:value-of select="/message"/></fn:string>
            </fn:map>
        </xsl:variable>
        <xsl:value-of select="fn:xml-to-json($result)"/>
    </xsl:template>
</xsl:stylesheet>
