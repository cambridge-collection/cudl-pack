<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:fn="http://www.w3.org/2005/xpath-functions"
                version="3.0">
    <xsl:output method="text" media-type="text/json"/>
    <xsl:variable name="input" select="fn:json-to-xml(/)"/>

    <xsl:template match="/">
        <xsl:variable name="result">
            <xsl:apply-templates select="fn:json-to-xml(/)"/>
        </xsl:variable>
        <xsl:copy-of select="$result"/>
        <xsl:value-of select="fn:xml-to-json($result)"/>
    </xsl:template>

    <xsl:template match="fn:array">
        <fn:number key="sum">
            <xsl:value-of select="sum(*)"/>
        </fn:number>
    </xsl:template>

    <xsl:template match="/fn:map">
        <xsl:message terminate="yes">Boom</xsl:message>
    </xsl:template>

    <xsl:template match="node()">
        <xsl:message terminate="yes">Boom</xsl:message>
        <xsl:copy>
            <xsl:apply-templates/>
        </xsl:copy>
    </xsl:template>
</xsl:stylesheet>
