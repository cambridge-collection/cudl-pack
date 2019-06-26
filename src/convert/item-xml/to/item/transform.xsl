<?xml version="1.0" encoding="UTF-8"?>
<!--
Translates an XML representation of a Package Item into Package Item JSON.
-->
<xsl:stylesheet xmlns:cdl="http://namespace.cudl.lib.cam.ac.uk/cdl"
                xmlns:xs="http://www.w3.org/2001/XMLSchema"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:fn="http://www.w3.org/2005/xpath-functions"
                xmlns:map="http://www.w3.org/2005/xpath-functions/map"
                version="3.1">
    <xsl:output method="json" indent="yes"/>

    <xsl:function name="cdl:as-qname" as="xs:QName?">
        <xsl:param name="qname-or-uri" as="xs:string"/>
        <xsl:param name="context" as="element()"/>

        <xsl:variable name="prefix" select="fn:tokenize($qname-or-uri, ':')[1]"/>

        <xsl:for-each select="fn:in-scope-prefixes($context)">
            <xsl:if test=". = $prefix">
                <xsl:copy-of select="fn:resolve-QName($qname-or-uri, $context)"/>
            </xsl:if>
        </xsl:for-each>
    </xsl:function>

    <xsl:template mode="namespace" match="/">
        <xsl:variable name="qnames" as="xs:QName*">
            <xsl:apply-templates select="/item/pages/page/resource|/item/data/data" mode="resolve-qnames"/>
        </xsl:variable>

        <xsl:if test="count($qnames) > 0">
            <xsl:map-entry key="'@namespace'">
                <xsl:map>
                    <xsl:for-each-group select="$qnames" group-by="fn:prefix-from-QName(.)">
                        <xsl:variable name="uri-prefix" as="xs:string+">
                            <xsl:for-each select="fn:current-group()">
                                <xsl:value-of select="fn:namespace-uri-from-QName(.)"/>
                            </xsl:for-each>
                        </xsl:variable>
                        <xsl:if test="count(fn:distinct-values($uri-prefix)) != 1">
                            <xsl:message terminate="yes">
                                Error: Cannot create @namespace: CURIE prefix <xsl:value-of select="fn:current-grouping-key()"/> is bound to multiple URIs: <xsl:value-of select="fn:distinct-values($uri-prefix)"/>
                            </xsl:message>
                        </xsl:if>
                        <xsl:map-entry key="fn:current-grouping-key()" select="$uri-prefix[1]"/>
                    </xsl:for-each-group>
                </xsl:map>
            </xsl:map-entry>
        </xsl:if>
    </xsl:template>

    <xsl:template mode="resolve-qnames" match="node()"/>
    <xsl:template mode="resolve-qnames" match="element()">
        <xsl:apply-templates select="element()" mode="#current"/>
    </xsl:template>

    <xsl:template mode="resolve-qnames" match="*[@type]">
<!--        <xsl:copy-of select="@type"/>-->
        <xsl:copy-of select="cdl:as-qname(@type, .)"/>
        <xsl:next-match/>
    </xsl:template>

    <xsl:template mode="resolve-qnames" match="*[@role]">
        <xsl:variable name="el" select="."/>
        <xsl:for-each select="fn:tokenize(fn:normalize-space(@role), ' ')">
            <xsl:copy-of select="cdl:as-qname(., $el)"/>
        </xsl:for-each>

        <xsl:next-match/>
    </xsl:template>

    <xsl:template match="/">
        <xsl:map>
            <xsl:apply-templates mode="namespace" select="/"/>
        </xsl:map>
    </xsl:template>
</xsl:stylesheet>
