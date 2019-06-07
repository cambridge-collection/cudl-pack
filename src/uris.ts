import {BiMap, CurieUtil, parseContext} from '@geneontology/curie-util-es5';

export const enum TypeUri {
    PackageItem = 'https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json',
    InternalItem = 'https://schemas.cudl.lib.cam.ac.uk/__internal__/v1/item.json',
}

type UriMap = Array<[string, string]>;

/**
 * Expand/compact URIs/CURIEs according to short names and URI prefixes.
 */
export class Namespace {
    private readonly curieTranslator: CurieUtil;

    /**
     * @param uriMap
     */
    constructor(uriMap: UriMap) {
        this.curieTranslator = getCurieTranslator(uriMap);
    }

    /**
     * Get the expanded form of a CURIE/URI value if it matches a CURIE prefix
     * in this namespace, otherwise return the value unchanged.
     */
    public getExpandedUri(curieOrUri: string): string {
        return this.curieTranslator.getIri(curieOrUri) || curieOrUri;
    }

    /**
     * Get the compacted form of a URI value if the URI matches an entry in this
     * namespace.
     */
    public getCompactedUri(uri: string): string {
        return this.curieTranslator.getCurie(uri) || uri;
    }
}

function getCurieTranslator(uriMap: UriMap): CurieUtil {
    const context: {[key: string]: string} = {};
    for(const [curiePrefix, iriPrefix] of uriMap) {
        context[curiePrefix] = iriPrefix;
    }

    return new CurieUtil(parseContext({'@context': context}));
}
