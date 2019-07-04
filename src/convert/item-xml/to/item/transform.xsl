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

    <!-- Top-level entry point - generate the entire item. -->
    <xsl:template match="/">
        <xsl:map>
            <xsl:map-entry key="'@type'">https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json</xsl:map-entry>
            <xsl:apply-templates mode="namespace" select="/"/>
            <xsl:apply-templates mode="data" select="/"/>
        </xsl:map>
    </xsl:template>

    <xsl:variable name="cdl:default-curie-prefixes" as="map(*)">
        <xsl:map>
            <xsl:map-entry key="'cdl-data'">https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json#/definitions/data/</xsl:map-entry>
            <xsl:map-entry key="'cdl-role'">https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json#data-role-</xsl:map-entry>
            <xsl:map-entry key="'cdl-page'">https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json#/definitions/pageResources/</xsl:map-entry>
        </xsl:map>
    </xsl:variable>

    <xsl:function name="cdl:get-in-scope-prefixes" as="map(*)">
        <xsl:param name="context" as="element()"/>

        <xsl:variable name="namespace-defined-prefixes" as="map(*)">
            <xsl:map>
                <xsl:for-each select="fn:in-scope-prefixes($context)">
                    <xsl:map-entry key="." select="fn:namespace-uri-for-prefix(., $context)"/>
                </xsl:for-each>
            </xsl:map>
        </xsl:variable>

        <xsl:copy-of select="map:merge(($namespace-defined-prefixes, $cdl:default-curie-prefixes))"/>
    </xsl:function>

    <xsl:function name="cdl:curie-as-qname" as="xs:QName?">
        <xsl:param name="qname-or-uri" as="xs:string"/>
        <xsl:param name="context" as="element()"/>

        <xsl:variable name="prefix" select="fn:tokenize($qname-or-uri, ':')[1]"/>
        <xsl:variable name="prefixes" select="cdl:get-in-scope-prefixes($context)"/>

        <xsl:if test="map:contains($prefixes, $prefix)">
            <xsl:copy-of select="fn:QName(map:get($prefixes, $prefix), $qname-or-uri)"/>
        </xsl:if>
    </xsl:function>

    <!-- Return true if the supplied QName uses one of the default prefixes. -->
    <xsl:function name="cdl:is-default-prefix" as="xs:boolean">
        <xsl:param name="qname" as="xs:QName"/>

        <xsl:value-of select="
            map:get($cdl:default-curie-prefixes, fn:prefix-from-QName($qname)) = fn:namespace-uri-from-QName($qname)"/>
    </xsl:function>

    <!-- Generate an @namespace map containing CURIE definitions from QNames
         used in the input XML. This requires that non-default (cdl-role, etc)
         have namespaces defined in the XML. -->
    <xsl:template mode="namespace" match="/">
        <xsl:variable name="qnames" as="xs:QName*">
            <xsl:apply-templates select="/item/pages/page/resource|/item/data/data" mode="resolve-qnames"/>
        </xsl:variable>

        <xsl:if test="count($qnames) > 0">
            <xsl:map-entry key="'@namespace'">
                <xsl:map>
                    <xsl:for-each-group select="$qnames" group-by="fn:prefix-from-QName(.)">
                        <xsl:variable name="prefix-uris" select="fn:distinct-values(for $qname in fn:current-group()
                                                                                      return fn:namespace-uri-from-QName($qname))"/>
                        <xsl:if test="count($prefix-uris) != 1">
                            <xsl:message terminate="yes">
                                Error: Cannot create @namespace: CURIE prefix <xsl:value-of select="fn:current-grouping-key()"/> is bound to multiple URIs: <xsl:value-of select="$prefix-uris"/>
                            </xsl:message>
                        </xsl:if>

                        <xsl:if test="not(cdl:is-default-prefix(.))">
                            <xsl:map-entry key="fn:current-grouping-key()" select="$prefix-uris[1]"/>
                        </xsl:if>
                    </xsl:for-each-group>
                </xsl:map>
            </xsl:map-entry>
        </xsl:if>
    </xsl:template>

    <!-- The resolve-qnames mode generates all QNames used by type and role attribute values through the document.  -->
    <xsl:template mode="resolve-qnames" match="node()"/>
    <xsl:template mode="resolve-qnames" match="element()">
        <xsl:apply-templates select="element()" mode="#current"/>
    </xsl:template>

    <xsl:template mode="resolve-qnames" match="*[@type]">
        <xsl:copy-of select="cdl:curie-as-qname(@type, .)"/>
        <xsl:next-match/>
    </xsl:template>

    <xsl:template mode="resolve-qnames" match="*[@role]">
        <xsl:copy-of select="for $role in fn:tokenize(fn:normalize-space(@role), ' ')
                               return cdl:curie-as-qname($role, .)"/>
        <xsl:next-match/>
    </xsl:template>

    <xsl:template match="/">
        <xsl:map>
            <xsl:apply-templates mode="namespace" select="/"/>
        </xsl:map>
    </xsl:template>
</xsl:stylesheet>
