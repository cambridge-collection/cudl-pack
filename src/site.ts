import {promisify} from 'util';
import xml2js from 'xml2js';

const parseXml: (xml: string | Buffer) => Promise<object> = promisify(new xml2js.Parser().parseString);

export async function parseSiteXml(xml: string | Buffer): Promise<Site> {
    return await parseXml(xml).then(loadSiteXml);
}

/**
 * Represents the entire content of a CUDL instance.
 */
export interface Site {
    name: string;
    collections: CollectionRef[];
}

/**
 * A reference to a collection contained by a site.
 */
export interface CollectionRef {
    href: string;
}

function loadSiteXml(siteXml: SiteXml): Site {

    return {
        name: siteXml.site.$.name,
        collections: [...getCollections(siteXml.site)],
    };
}

function* getCollections(site: SiteElement) {
    for(const collectionsEls of site.collections) {
        for(const collection of collectionsEls.collection) {
            yield {
                href: collection.$.href,
            };
        }
    }
}

// These types represent the result of parsing the site XML with xml2js.
interface SiteXml {
    site: SiteElement;
}

interface SiteElement {
    $: {name: string};
    collections: CollectionsElement[];
}

interface CollectionsElement {
    collection: CollectionElement[];
}

interface CollectionElement {
    '$': {
        href: string;
    };
}
