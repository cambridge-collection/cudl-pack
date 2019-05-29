import Ajv from 'ajv';
import parseJson from 'json-parse-better-errors';
import {promisify} from 'util';
import xml2js from 'xml2js';

import {dlDatasetId, validateDlDataset, ValidationOptions} from './schemas';

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

export function parseDlDatasetJson(json: string, options?: ValidationOptions): DlDataset {
    const dlDataset = parseJson(json);
    validateDlDataset(dlDataset, options);

    return dlDataset;
}

/**
 * Represents the entire content of a CUDL instance.
 */
export interface DlDataset {
    '@type': 'https://schemas.cudl.lib.cam.ac.uk/package/v1/dl-dataset.json';
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
        '@type': 'https://schemas.cudl.lib.cam.ac.uk/package/v1/dl-dataset.json',
        'name': dlDatasetXml['dl-dataset'].$.name,
        'collections': [...getCollections(dlDatasetXml['dl-dataset'])],
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
