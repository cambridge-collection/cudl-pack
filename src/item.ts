import parseJson from 'json-parse-better-errors';
import * as util from 'util';
import {promisify} from 'util';
import webpack from 'webpack';
import {isNamespaceBearer, isNamespaceMap, Item, NamespaceBearer, NamespaceMap} from './item-types';
import {validateItem, ValidationOptions} from './schemas';
import {Namespace} from './uris';

export function parseItemJson(json: string, options?: ValidationOptions): Item {
    const object: unknown = parseJson(json);

    return validateItem(object, options);
}

export function generateItemJson(item: Item): string {
    return JSON.stringify(item);
}

type NamespaceValue = string | NamespaceMap | undefined;
type NamespaceResolver = (url: string) => Promise<NamespaceMap>;

export class NamespaceLoader {
    /**
     * Create a NamespaceLoader which resolves @namespace URLs as webpack module
     * requests.
     */
    public static forWebpackLoader(context: webpack.loader.LoaderContext): NamespaceLoader {
        const resolver: NamespaceResolver = async (url) => {
            const source: string = await promisify(context.loadModule)(url);
            let map;
            let err;
            try {
                map = parseJson(source);
                if(isNamespaceMap(map))
                    return map;
                err = `Resolved JSON value is not a NamespaceMap: ${util.inspect(map)}`;
            }
            catch(e) {
                err = `Resolved module is not a valid JSON document: ${e}`;
            }

            throw new Error(`Unable to load @namespace reference ${url}: ${err}`);
        };
        return new NamespaceLoader(resolver);
    }

    private readonly namespaceResolver: NamespaceResolver;

    constructor(namespaceResolver: NamespaceResolver) {
        this.namespaceResolver = namespaceResolver;
    }

    public async loadNamespace(namespace: NamespaceBearer | NamespaceValue): Promise<Namespace> {
        let namespaceMap: NamespaceMap;
        if(isNamespaceBearer(namespace)) {
            return this.loadNamespace(namespace['@namespace']);
        }
        if(typeof namespace === 'string') {
            namespaceMap = await this.resolveNamespaceMapReference(namespace);
        }
        else {
            namespaceMap = namespace || {};
        }

        return Namespace.fromNamespaceMap(namespaceMap);
    }

    private async resolveNamespaceMapReference(url: string): Promise<NamespaceMap> {
        return this.namespaceResolver(url);
    }
}
