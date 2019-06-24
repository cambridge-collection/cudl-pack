<?xml version="1.0"?>
<xsl:stylesheet version="2.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:fn="http://www.w3.org/2005/xpath-functions"
                xmlns:foo="foo"
                exclude-result-prefixes="fn foo">
    <xsl:import href="shared.xsl"/>

    <xsl:template match="/">
        <foo><xsl:value-of select="foo:bar(10)"/></foo>
    </xsl:template>
</xsl:stylesheet>
