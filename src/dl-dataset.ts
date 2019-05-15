import Ajv from 'ajv';
import {promisify} from 'util';
import xml2js from 'xml2js';

const parseXml: (xml: string | Buffer) => Promise<object> = promisify(new xml2js.Parser().parseString);

export function parseDlDatasetXml(xml: string | Buffer): Promise<DlDataset> {
    return parseXml(xml)
    .then((dlDatasetXml) => {
        if(!ajv.validate('parsedDlDatasetXml', dlDatasetXml)) {
            throw new Error(`Parsed dl-dataset XML is invalid: ${ajv.errorsText()}`);
        }
        return dlDatasetXml;
    })
    .then(loadDlDatasetXml);
}

export function parseDlDatasetJson(json: string): DlDataset {
    const dlDataset = JSON.parse(json);

    if(!ajv.validate('dl-dataset', dlDataset)) {
        throw new Error(`dl-dataset JSON is invalid: ${ajv.errorsText()}`);
    }

    return dlDataset;
}

/**
 * Represents the entire content of a CUDL instance.
 */
export interface DlDataset {
    name: string;
    collections: CollectionRef[];
}

/**
 * A reference to a collection contained by a dl-dataset.
 */
export interface CollectionRef {
    '@id': string;
}

function loadDlDatasetXml(dlDatasetXml: DlDatasetXml): DlDataset {

    return {
        name: dlDatasetXml['dl-dataset'].$.name,
        collections: [...getCollections(dlDatasetXml['dl-dataset'])],
    };
}

function* getCollections(dlDataset: DlDatasetElement) {
    for(const collectionsEls of dlDataset.collections) {
        for(const collection of collectionsEls.collection) {
            yield {
                '@id': collection.$.href,
            };
        }
    }
}

// These types represent the result of parsing the dl-dataset XML with xml2js.
interface DlDatasetXml {
    'dl-dataset': DlDatasetElement;
}

interface DlDatasetElement {
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
        dlDatasetElement: requireAllProperties({
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
        'dl-dataset': {$ref: '#/definitions/dlDatasetElement'},
    },
}), 'parsedDlDatasetXml');

ajv.addSchema(requireAllProperties({
    type: 'object',
    properties: {
        name: {type: 'string'},
        collections: {
            type: 'array',
            items: requireAllProperties({
                type: 'object',
                properties: {
                    '@id': {type: 'string'},
                },
            }),
        },
    },
}), 'dl-dataset');
