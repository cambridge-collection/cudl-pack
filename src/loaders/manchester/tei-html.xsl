<?xml version="1.0"?>
<xsl:stylesheet version="2.0"
                xmlns:cudl="http://cudl.lib.cam.ac.uk/"
                xmlns:fn="http://www.w3.org/2005/xpath-functions"
                xmlns:t="http://www.tei-c.org/ns/1.0"
                xmlns:xs="http://www.w3.org/2001/XMLSchema"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:teihtml="http://namespace.cudl.lib.cam.ac.uk/tei-html"
                exclude-result-prefixes="cudl fn t xs">

    <!-- Very incomplete TEI -> HTML conversion.
         It's expected that the resulting elements be serialised to HTML with
         https://www.w3.org/TR/xpath-functions-30/#func-serialize -->

    <xsl:template mode="teihtml:name" match="element()"><xsl:value-of select="name()"/></xsl:template>
    <xsl:template mode="teihtml:name" match="t:seg"><xsl:value-of select="'p'"/></xsl:template>
    <xsl:template mode="teihtml:name" match="t:table/t:head"><xsl:value-of select="'caption'"/></xsl:template>
    <xsl:template mode="teihtml:name" match="t:table/t:row"><xsl:value-of select="'tr'"/></xsl:template>
    <xsl:template mode="teihtml:name" match="t:*[@rend='italic']"><xsl:value-of select="'i'"/></xsl:template>
    <xsl:template mode="teihtml:name" match="t:*[@rend='superscript']"><xsl:value-of select="'sup'"/></xsl:template>
    <xsl:template mode="teihtml:name" match="t:*[@rend='subscript']"><xsl:value-of select="'sub'"/></xsl:template>
    <xsl:template mode="teihtml:name" match="t:*[@rend='bold']"><xsl:value-of select="'b'"/></xsl:template>

    <xsl:template match="node()" mode="teihtml:html"/>
    <xsl:template match="text()" mode="teihtml:html"><xsl:copy/></xsl:template>
    <xsl:template match="element()" mode="teihtml:html">
        <xsl:apply-templates mode="#current"/>
    </xsl:template>

    <xsl:template match="
        t:p |
        t:seg[@type='para'] |
        t:table |
        t:table/t:head |
        t:table/t:row" mode="teihtml:html">
        <xsl:variable name="name" as="xs:NCName">
            <xsl:apply-templates select="." mode="teihtml:name"/>
        </xsl:variable>

        <xsl:element name="{$name}">
            <xsl:apply-templates mode="#current"/>
        </xsl:element>
    </xsl:template>

    <xsl:template match="t:locus[normalize-space(@from)]" mode="teihtml:html">
        <a href="cudl:///page?n={encode-for-uri(normalize-space(@from))}"><xsl:apply-templates mode="#current"/></a>
    </xsl:template>

</xsl:stylesheet>
