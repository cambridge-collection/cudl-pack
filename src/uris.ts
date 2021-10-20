import clone from "clone";
import lodash from "lodash";
import * as util from "util";
import { NamespaceBearer, NamespaceMap } from "./item-types";

interface CurieDefinitionData {
    /** The part of the CURIE before the first colon. */
    readonly curiePrefix: string;

    /** The base URI that a CURIE suffix is appended to when expanding. */
    readonly uriPrefix: string;
}

class CurieDefinition implements CurieDefinitionData {
    public readonly curiePrefix: string;
    public readonly uriPrefix: string;

    constructor(curiePrefix: string, uriPrefix: string) {
        this.curiePrefix = curiePrefix;
        this.uriPrefix = uriPrefix;
    }

    public uri(suffix: string): string {
        return this.uriPrefix + suffix;
    }

    public curie(suffix: string): string {
        return this.curiePrefix + ":" + suffix;
    }

    public compact(uri: string): string {
        if (!uri.startsWith(this.uriPrefix))
            throw new Error(`\
uri is not prefixed by this curie's prefix: ${util.inspect(
                this.uriPrefix
            )}, uri: ${util.inspect(uri)}`);
        return this.curie(uri.substring(this.uriPrefix.length));
    }
}

export const enum TypeUri {
    PackageItem = "https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json",
    InternalItem = "https://schemas.cudl.lib.cam.ac.uk/__internal__/v1/item.json",
}

export class PackageItemPage {
    public static readonly curie = new CurieDefinition(
        "cdl-page",
        "https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json#/definitions/pageResources/"
    );

    public static readonly image = PackageItemPage.curie.uri("image");
    public static readonly translation =
        PackageItemPage.curie.uri("translation");
    public static readonly transcription =
        PackageItemPage.curie.uri("transcription");

    private constructor() {}
}

export class CDLRole {
    public static readonly curie = new CurieDefinition(
        "cdl-role",
        "https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json#data-role-"
    );

    private constructor() {}
}

export class PackageItemData {
    public static readonly curie = new CurieDefinition(
        "cdl-data",
        "https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json#/definitions/data/"
    );

    public static readonly properties = PackageItemData.curie.uri("properties");
    public static readonly link = PackageItemData.curie.uri("link");

    private constructor() {}
}

/**
 * Expand/compact URIs/CURIEs according to short names and URI prefixes.
 *
 * CURIEs/URIs are expanded compacted deterministically according to the order
 * of CURIE definitions used to create the Namespace: Both when expanding and
 * compacting, the first-matching definition in the list is used to
 * expand/compact.
 */
export class Namespace {
    // expand/compact are implemented in quite a simple O(n) manner in order to
    // ensure we provide deterministic expansion/compaction according to the
    // contract described in the class description. The number of entries is
    // expected to be < 10, often < 5, so this shouldn't be a problem.

    /**
     * Create a Namespace from CURIE definitions from an item's NamespaceMap
     * with a deterministic order.
     *
     * The definitions are ordered with longer prefixes first, so the most
     * specific CURIE will be used when compressing.
     */
    public static fromNamespaceMap(namespaceMap: NamespaceMap): Namespace {
        const orderedEntries: Array<[string, string]> = lodash.orderBy(
            lodash.toPairs(namespaceMap),
            [
                ([curiePrefix, uriPrefix]) => uriPrefix.length,
                ([curiePrefix, uriPrefix]) => uriPrefix,
                ([curiePrefix, uriPrefix]) => curiePrefix,
            ],
            ["desc", "asc", "asc"]
        );

        return new Namespace(
            defaultCuries().concat(
                orderedEntries.map(([curiePrefix, uriPrefix]) => ({
                    curiePrefix,
                    uriPrefix,
                }))
            )
        );
    }

    private readonly curies: CurieDefinitionData[];

    /**
     * @param curies The CURIEs to include in the namespace.
     */
    constructor(curies: CurieDefinitionData[]) {
        this.curies = clone(curies);
    }

    /**
     * Get the expanded form of a CURIE/URI value if it matches a CURIE prefix
     * in this namespace, otherwise return the value unchanged.
     */
    public getExpandedUri(curieOrUri: string): string {
        const [prefix, ...suffix] = curieOrUri.split(":");

        if (suffix.length > 0) {
            for (const curie of this.curies) {
                if (curie.curiePrefix === prefix) {
                    return `${curie.uriPrefix}${suffix.join(":")}`;
                }
            }
        }

        return curieOrUri;
    }

    /**
     * Get the compacted form of a URI value if the URI matches an entry in this
     * namespace.
     */
    public getCompactedUri(uri: string): string {
        for (const curie of this.curies) {
            if (uri.startsWith(curie.uriPrefix)) {
                const curieSuffix = uri.substr(curie.uriPrefix.length);
                return `${curie.curiePrefix}:${curieSuffix}`;
            }
        }

        return uri;
    }
}

export function defaultCuries(): CurieDefinitionData[] {
    return [PackageItemData.curie, CDLRole.curie, PackageItemPage.curie];
}
