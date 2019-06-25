<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:fn="http://www.w3.org/2005/xpath-functions"
                version="3.1">
    <xsl:output method="json" indent="yes"/>

    <xsl:template match="/">
        <xsl:copy-of select="map {'message': [string(/message), 'foo']}"/>
    </xsl:template>
</xsl:stylesheet>
