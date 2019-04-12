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

export function parseSiteJson(json: string): Site {
    const site = JSON.parse(json);

    if(!ajv.validate('site', site)) {
        throw new Error(`site JSON is invalid: ${ajv.errorsText()}`);
    }

    return site;
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

function requireAllProperties(objSchema: {type: 'object', properties: object, [propName: string]: any}) {
    return {
        ...objSchema,
        required: Object.keys(objSchema.properties),
    };
}

const ajv = new Ajv();
ajv.addSchema(requireAllProperties({
    definitions: {
        siteElement: requireAllProperties({
            type: 'object',
            properties: {
                $: requireAllProperties({
                    type: 'object',
                    properties: {
                        name: {type: 'string'},
                    },
                }),
                collections: {
                    type: 'array',
                    items: {$ref: '#/definitions/collectionsElement'},
                },
            },
        }),

        collectionsElement: requireAllProperties({
            type: 'object',
            properties: {
                collection: {
                    type: 'array',
                    items: {$ref: '#/definitions/collectionElement'},
                },
            },
        }),

        collectionElement: requireAllProperties({
            type: 'object',
            properties: {
                $: requireAllProperties({
                    type: 'object',
                    properties: {
                        href: {type: 'string'},
                    },
                }),
            },
        }),
    },

    type: 'object',
    properties: {
        site: {$ref: '#/definitions/siteElement'},
    },
}), 'parsedSiteXml');

ajv.addSchema(requireAllProperties({
    type: 'object',
    properties: {
        name: {type: 'string'},
        collections: {
            type: 'array',
            items: requireAllProperties({
                type: 'object',
                properties: {
                    href: {type: 'string'},
                },
            }),
        },
    },
}), 'site');
