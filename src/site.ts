import Ajv from 'ajv';
import {promisify} from 'util';
import xml2js from 'xml2js';

const parseXml: (xml: string | Buffer) => Promise<object> = promisify(new xml2js.Parser().parseString);

export function parseSiteXml(xml: string | Buffer): Promise<Site> {
    return parseXml(xml)
    .then((siteXml) => {
        if(!ajv.validate('parsedSiteXml', siteXml)) {
            throw new Error(`Parsed site XML is invalid: ${ajv.errorsText()}`);
        }
        return siteXml;
    })
    .then(loadSiteXml);
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

const ajv = new Ajv();
ajv.addSchema({
    definitions: {
        siteElement: {
            type: 'object',
            properties: {
                $: {
                    type: 'object',
                    properties: {
                        name: {type: 'string'},
                    },
                    required: ['name'],
                },
                collections: {
                    type: 'array',
                    items: {$ref: '#/definitions/collectionsElement'},
                },
            },
            required: ['$', 'collections'],
        },

        collectionsElement: {
            type: 'object',
            properties: {
                collection: {
                    type: 'array',
                    items: {$ref: '#/definitions/collectionElement'},
                },
            },
            required: ['collection'],
        },

        collectionElement: {
            type: 'object',
            properties: {
                $: {
                    type: 'object',
                    properties: {
                        href: {type: 'string'},
                    },
                    required: ['href'],
                },
            },
            required: ['$'],
        },
    },

    type: 'object',
    properties: {
        site: {$ref: '#/definitions/siteElement'},
    },
    required: ['site'],
}, 'parsedSiteXml');
