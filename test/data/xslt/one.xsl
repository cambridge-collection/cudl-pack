<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    version="1.1">
    <xsl:template match="/">
        <foobar><xsl:copy-of select="."/></foobar>
    </xsl:template>
</xsl:stylesheet>
