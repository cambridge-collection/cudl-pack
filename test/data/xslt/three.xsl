<?xml version="1.0"?>
<xsl:stylesheet version="3.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:template match="/">
        <xsl:try>
            <number><xsl:value-of select="1 div 0"/></number>
            <xsl:catch>
                <handledError/>
            </xsl:catch>
        </xsl:try>
    </xsl:template>
</xsl:stylesheet>
