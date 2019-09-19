<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:cdl="http://namespace.cudl.lib.cam.ac.uk/cdl"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                version="3.1">

    <!-- Extend the default transformation -->
    <xsl:import href="../../../../../src/convert/item-xml/to/item/transform.xsl"/>

    <!-- Define a template to match and handle our custom page resource type -->
    <xsl:template mode="page-resource-properties"
                  match="resource[cdl:expand-curie-or-uri(@type, .) = 'http://example.org/page-resource/custom']">
        <xsl:map-entry key="'foo'" select="string(foo)"/>
    </xsl:template>
</xsl:stylesheet>
