<?xml version="1.0" encoding="UTF-8"?>
<!--
Translates an XML representation of a Package Item into Package Item JSON.
-->
<xsl:stylesheet xmlns:cdl="http://namespace.cudl.lib.cam.ac.uk/cdl"
                xmlns:item="https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json"
                xmlns:item-data="https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json#/definitions/data/"
                xmlns:xs="http://www.w3.org/2001/XMLSchema"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:fn="http://www.w3.org/2005/xpath-functions"
                xmlns:map="http://www.w3.org/2005/xpath-functions/map"
                xmlns:math="http://www.w3.org/2005/xpath-functions/math"
                version="3.1">
    <xsl:output method="json" indent="yes"/>

    <xsl:variable name="item-error" as="xs:QName" select="QName('https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json', 'item:error')"/>

    <!-- Top-level entry point - generate the entire item. -->
    <xsl:template match="/">
        <xsl:map>
            <xsl:map-entry key="'@type'">https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json</xsl:map-entry>
            <xsl:apply-templates mode="namespace" select="/"/>
            <xsl:apply-templates mode="data" select="/"/>
            <xsl:apply-templates mode="descriptions" select="/"/>
            <xsl:apply-templates mode="pages" select="/"/>

            <!-- Fail on and allow overriding unexpected elements. -->
            <xsl:apply-templates select="/item/element()[not(. = (/item/data|/item/descriptions|/item/pages))]"/>
        </xsl:map>
    </xsl:template>

    <!-- Fail if unexpected content appears in the document being transformed.
         This allows us to raise errors without explicitly checking for
         unexpected content by being permissive about what we send through
         xsl:apply-templates and restrictive about what we match. It also allows
         another stylesheet to this by matching content that this doesn't.
         -->
    <xsl:template mode="#all" match="node()" priority="-1">
        <xsl:copy-of select="error($item-error, 'Unexpected content encountered at ' || path() || ' :: ' || .)"/>
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

    <xsl:function name="cdl:expand-curie-or-uri" as="xs:anyURI">
        <xsl:param name="qname-or-uri" as="xs:string"/>
        <xsl:param name="context" as="element()"/>

        <xsl:value-of select="(for $qname in (cdl:curie-as-qname($qname-or-uri, $context))
                                 return namespace-uri-from-QName($qname) || local-name-from-QName($qname),
                               $qname-or-uri)[1]"/>
    </xsl:function>

    <xsl:function name="cdl:error-missing-attribute">
        <xsl:param name="el" as="element()"/>
        <xsl:param name="attr-name" as="xs:string"/>
        <xsl:param name="attr-ns" as="xs:string"/>

        <xsl:copy-of select="error($item-error, '&lt;' || name($el) || '&gt; has no {' || $attr-ns || '}' || $attr-name || ' attribute at ' || path($el))"/>
    </xsl:function>

    <xsl:function name="cdl:require-attribute">
        <xsl:param name="el" as="element()"/>
        <xsl:param name="attr-name" as="xs:string"/>

        <xsl:copy-of select="cdl:require-attribute($el, $attr-name, '')"/>
    </xsl:function>

    <xsl:function name="cdl:require-attribute">
        <xsl:param name="el" as="element()"/>
        <xsl:param name="attr-name" as="xs:string"/>
        <xsl:param name="attr-ns" as="xs:string" default="''"/>

        <xsl:variable name="attr" as="attribute()?" select="$el/@*[local-name() = $attr-name and namespace-uri() = $attr-ns][1]"/>
        <xsl:copy-of select="if ($attr)
                               then string($attr)
                               else cdl:error-missing-attribute($el, $attr-name, $attr-ns)"/>
    </xsl:function>

    <!-- Generate an @namespace map containing CURIE definitions from QNames
         used in the input XML. This requires that non-default (cdl-role, etc)
         have namespaces defined in the XML. -->
    <xsl:template mode="namespace" match="/">
        <xsl:variable name="qnames" as="xs:QName*">
            <xsl:apply-templates select="/item/pages/page/resource|/item/data" mode="resolve-qnames"/>
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

    <xsl:template mode="data" match="/">
        <xsl:variable name="data" as="map(*)*">
            <xsl:apply-templates select="/item/data" mode="data-item"/>
        </xsl:variable>

        <xsl:if test="count($data) > 0">
            <xsl:map-entry key="'data'" select="array{$data}"/>
        </xsl:if>
    </xsl:template>

    <xsl:template mode="data-item" match="data">
        <xsl:map>
            <xsl:map-entry key="'@type'" select="if (@type) then string(@type) else error($item-error, '&lt;data&gt; item has no type attribute')"/>
            <xsl:if test="@role">
                <xsl:map-entry key="'@role'" select="string(@role)"/>
            </xsl:if>
            <xsl:apply-templates mode="data-item-properties" select="."/>
        </xsl:map>
    </xsl:template>

    <xsl:template mode="data-item-properties" match="data">
        <xsl:copy-of select="error($item-error, 'No template handled item data with type: ' || @type)"/>
    </xsl:template>

    <xsl:template mode="data-item-properties"
                  match="data[cdl:expand-curie-or-uri(@type, .) = 'https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json#/definitions/data/link']">
        <xsl:map-entry key="'href'">
            <xsl:map-entry key="'@id'" select="cdl:require-attribute(., 'href')"/>
        </xsl:map-entry>
    </xsl:template>

    <xsl:template mode="data-item-properties"
                  match="data[cdl:expand-curie-or-uri(@type, .) = 'https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json#/definitions/data/properties']">
        <xsl:apply-templates select="element()" mode="item-data:properties"/>
    </xsl:template>

    <xsl:template mode="item-data:properties" match="node()">
        <xsl:copy-of select="error($item-error, 'Unexpected content in cdl-data:properties &lt;data&gt;: ' || .)"/>
    </xsl:template>

    <xsl:template mode="item-data:properties" match="/item/data/(array|string|number|true|false)">
        <xsl:map-entry key="cdl:require-attribute(., 'name')">
            <xsl:next-match/>
        </xsl:map-entry>
    </xsl:template>

    <xsl:template mode="item-data:properties" match="array">
        <xsl:variable name="content" as="item()*">
            <xsl:apply-templates mode="#current" select="element()"/>
        </xsl:variable>
        <xsl:copy-of select="array{$content}"/>
    </xsl:template>
    <xsl:template mode="item-data:properties" match="string"><xsl:copy-of select="string(.)"/></xsl:template>
    <xsl:template mode="item-data:properties" match="number"><xsl:copy-of select="number(.)"/></xsl:template>
    <xsl:template mode="item-data:properties" match="true"><xsl:copy-of select="true()"/></xsl:template>
    <xsl:template mode="item-data:properties" match="false"><xsl:copy-of select="false()"/></xsl:template>

    <xsl:template mode="descriptions" match="/">
        <xsl:map-entry key="'descriptions'">
            <xsl:map>
                <xsl:apply-templates mode="#current" select="/item/descriptions/description"/>
            </xsl:map>
        </xsl:map-entry>
    </xsl:template>

    <xsl:template mode="descriptions" match="/item/descriptions/description">
        <xsl:map-entry key="if (@name) then string(@name) else error($item-error, 'description element has no name attribute: ' || path())">
            <xsl:map>
                <xsl:map-entry key="'coverage'"
                               select="map{'firstPage': if (coverage/@firstPage) then string(coverage/@firstPage[1]) else true(),
                                           'lastPage': if (coverage/@lastPage) then string(coverage/@lastPage[1]) else true()}"/>
                <xsl:map-entry key="'attributes'">
                    <xsl:apply-templates mode="#current" select="attributes"/>
                </xsl:map-entry>
            </xsl:map>
        </xsl:map-entry>
    </xsl:template>

    <xsl:template mode="descriptions" match="/item/descriptions/description/attributes[1]">
        <xsl:map>
            <xsl:apply-templates mode="#current" select="element()"/>
        </xsl:map>
    </xsl:template>

    <xsl:template mode="descriptions" match="/item/descriptions/description/attributes[1]/attribute">
        <xsl:map-entry key="cdl:require-attribute(., 'name')">
            <xsl:map>
                <xsl:map-entry key="'label'" select="cdl:require-attribute(., 'label')"/>
                <xsl:if test="@order">
                    <xsl:map-entry key="'order'" select="string(@order)"/>
                </xsl:if>
                <xsl:apply-templates mode="descriptions-attribute-value" select="."/>
            </xsl:map>
        </xsl:map-entry>
    </xsl:template>

    <xsl:template mode="descriptions-attribute-value" match="attribute">
        <xsl:copy-of select="error($item-error, 'invalid &lt;attribute&gt; value(s) at ' || path())"/>
    </xsl:template>

    <xsl:template mode="descriptions-attribute-value" match="attribute[@value and not(element() | text())]">
        <xsl:map-entry key="'value'" select="serialize(string(@value), map{'method': 'html'})"/>
    </xsl:template>

    <xsl:template mode="descriptions-attribute-value" match="attribute[(text() | element()) and not(@value | value)]">
        <xsl:map-entry key="'value'" select="serialize(text() | element(), map{'method': 'html'})"/>
    </xsl:template>

    <xsl:template mode="descriptions-attribute-value" match="attribute[value and not(count(value) lt count(element()))]">
        <xsl:map-entry key="'value'" select="array{for $val in value return serialize($val/(text() | element()), map{'method': 'html'})}"/>
    </xsl:template>

    <xsl:template mode="pages" match="/">
        <xsl:map-entry key="'pages'">
            <xsl:map>
                <xsl:apply-templates mode="#current" select="/item/pages/page">
                    <!-- Generate a number format string to generate order
                         strings with. We use the 0-padded index of the page,
                         e.g. if there are 300 pages, page 32 is order '032'
                         and in this case the format string would be '000'. -->
                    <xsl:with-param name="order-pad" select="string-join(for $n in 1 to xs:integer(math:log10(max((1, count(/item/pages/page) - 1)))) + 1 return '0')"/>
                </xsl:apply-templates>
            </xsl:map>
        </xsl:map-entry>
    </xsl:template>

    <xsl:template mode="pages" match="/item/pages[1]/page">
        <xsl:param name="order-pad" as="xs:string" required="yes"/>
        <xsl:map-entry key="cdl:require-attribute(., 'name')">
            <xsl:map>
                <xsl:map-entry key="'label'" select="cdl:require-attribute(., 'label')"/>
                <xsl:map-entry key="'order'" select="format-number(position() - 1, $order-pad)"/>
                <xsl:apply-templates mode="#current" select="element()"/>
            </xsl:map>
        </xsl:map-entry>
    </xsl:template>

    <xsl:template mode="pages" match="/item/pages[1]/page/resource[cdl:expand-curie-or-uri(@type, .) = 'https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json#/definitions/pageResources/image']">

    </xsl:template>
</xsl:stylesheet>
