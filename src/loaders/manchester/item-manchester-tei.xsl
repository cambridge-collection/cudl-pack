<?xml version="1.0"?>
<xsl:stylesheet version="2.0"
                xmlns:cudl="http://cudl.lib.cam.ac.uk/"
                xmlns:fn="http://www.w3.org/2005/xpath-functions"
                xmlns:t="http://www.tei-c.org/ns/1.0"
                xmlns:teihtml="http://namespace.cudl.lib.cam.ac.uk/tei-html"
                xmlns:xs="http://www.w3.org/2001/XMLSchema"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                exclude-result-prefixes="cudl fn t teihtml xs">

    <xsl:import href="tei-html.xsl"/>

    <xsl:template match="/">
        <xsl:result-document indent="yes">
            <item>
                <xsl:apply-templates select="/" mode="descriptions"/>
                <xsl:apply-templates select="/" mode="pages"/>
            </item>
        </xsl:result-document>
    </xsl:template>

    <xsl:function name="cudl:get-section-id" as="xs:string">
        <xsl:param name="index-in-document" as="xs:integer"/>

        <xsl:value-of select="if ($index-in-document = 1)
                                  then 'main'
                                  else concat('ITEM-', $index-in-document)"/>
    </xsl:function>

    <!-- Description generation -->
    <xsl:function name="cudl:get-coverage" as="element()">
        <xsl:param name="locus" as="element()?"/>

        <coverage>
            <xsl:if test="($locus/@from)[.][cudl:page-id-for-label(.)]">
                <xsl:attribute name="firstPage" select="cudl:page-id-for-label($locus/@from)"/>
            </xsl:if>
            <xsl:if test="($locus/@to)[.][cudl:page-id-for-label(.)]">
                <xsl:attribute name="lastPage" select="cudl:page-id-for-label($locus/@to)"/>
            </xsl:if>
        </coverage>
    </xsl:function>

    <xsl:template match="/" mode="descriptions">
        <descriptions>
            <xsl:apply-templates select="//t:msItem" mode="descriptions"/>
        </descriptions>
    </xsl:template>

    <xsl:template match="t:msItem" mode="descriptions">
        <xsl:variable name="id" select="cudl:get-section-id(position())"/>
        <description xml:id="{$id}">
            <xsl:copy-of select="cudl:get-coverage(t:locus[1])"/>
            <attributes>
                <xsl:variable name="attribute-values">
                    <xsl:if test="$id = 'main'">
                        <xsl:apply-templates select="/" mode="main-attributes"/>
                    </xsl:if>

                    <xsl:apply-templates select="." mode="attributes"/>
                </xsl:variable>

                <xsl:for-each-group select="$attribute-values/*" group-by="@name">
                    <xsl:variable name="attribute">
                        <attribute name="{current-grouping-key()}">
                            <xsl:copy-of select="current-group()"/>
                        </attribute>
                    </xsl:variable>
                    <xsl:apply-templates select="$attribute" mode="finish-attributes"/>
                </xsl:for-each-group>
            </attributes>
        </description>
    </xsl:template>

    <!-- mode finish-attributes :: Used to generate labels and sort keys for
         grouped <attribute-value>s.-->

    <xsl:variable name="attribute-defaults">
        <attribute name="title" label="title" sort="a"/>
        <attribute name="alt-title" label="Alternative Title(s)" sort="b"/>
    </xsl:variable>
    
    <xsl:template match="attribute[not(@label)]" mode="finish-attributes">
        <xsl:variable name="name" select="@name"/>
        <xsl:variable name="default" select="$attribute-defaults/*[@name = $name][1]" as="element()?"/>
        <xsl:copy>
            <xsl:copy-of select="$default/@sort"/>
            <xsl:attribute name="label" select="(
                $default/@label,
                fn:concat(fn:upper-case(substring(@name, 1, 1)), fn:replace(substring(@name, 2), '[_-]', ' '))
            )[1]"/>
            <xsl:copy-of select="attribute()"/>
            <xsl:apply-templates select="attribute-value" mode="#current"/>
        </xsl:copy>
    </xsl:template>

    <xsl:template match="attribute-value" mode="finish-attributes">
        <value><xsl:copy-of select="."/></value>
    </xsl:template>

    <!-- mode main-attributes :: Used to generate intermediate <attribute-value>
         elements for the 'main' description.-->

    <!-- Ignore anything inside msItem elements when generating main attributes. -->
    <xsl:template match="t:msItem" mode="main-attributes"/>

    <xsl:template match="t:sourceDesc/t:msDesc/t:msContents/t:summary" mode="main-attributes">
        <attribute-value name="abstract">
            <xsl:apply-templates select="." mode="teihtml:html"/>
        </attribute-value>

        <xsl:next-match/>
    </xsl:template>

    <xsl:template match="t:msItem" name="titles" mode="attributes">
        <xsl:variable name="titles" select="//t:title"/>
        <xsl:variable name="title" select="(
            $titles[not(@type)],
            $titles[@type = 'general'],
            $titles[@type = 'standard'],
            $titles[@type = 'supplied']
        )[1]"/>

        <attribute-value name="title"><xsl:value-of select="($title, 'Untitled Item')[1]"/></attribute-value>
        <xsl:for-each select="$titles[. != $title]">
            <attribute-value name="alt-title"><xsl:value-of select="."/></attribute-value>
        </xsl:for-each>

        <xsl:next-match/>
    </xsl:template>

    <!-- Traverse all elements when searching for main or regular attributes -->
    <xsl:template match="element()" mode="main-attributes attributes">
        <xsl:apply-templates select="element()" mode="#current"/>
    </xsl:template>

    <!-- mode attributes :: Used to generate intermediate <attribute-value>
         elements from content inside the tei:msItem for each <description>'s
         <attributes> section.-->

    <!-- Page generation -->
    <xsl:key name="pb-by-n" match="/t:TEI/t:text/t:body//t:pb" use="@n"/>
    <xsl:function name="cudl:page-id-for-label" as="xs:string">
        <xsl:param name="label" as="xs:string?"/>

        <xsl:value-of select="key('pb-by-n', $label)/@xml:id"/>
    </xsl:function>

    <xsl:template match="/" mode="pages">
        <xsl:apply-templates select="/t:TEI/t:text/t:body" mode="pages"/>
    </xsl:template>

    <xsl:template match="t:body" mode="pages">
        <pages>
            <xsl:apply-templates select="//t:pb" mode="pages"/>
        </pages>
    </xsl:template>

    <xsl:template match="t:pb[@facs]" mode="pages">
        <page xml:id="{@xml:id}" label="{@n}">
            <xsl:apply-templates select="fn:id(substring(@facs, 2))/t:graphic" mode="pages"/>
        </page>
    </xsl:template>

    <xsl:template match="t:graphic" mode="pages">
        <resource type="cdl-page:image">
            <imageType>iiif</imageType>
            <image><xsl:value-of select="@url"/></image>
        </resource>
    </xsl:template>

    <xsl:template match="node()" mode="pages"/>

    <!-- mode html :: Generic TEI to HTML conversion -->


</xsl:stylesheet>
