import { strict as assert } from "assert";
import fp from "lodash/fp";
import {
    AsyncSeriesWaterfallHook,
    HookMap,
    SyncBailHook,
    SyncHook,
} from "tapable";
import {
    createDescriptiveMetadataSection,
    DescriptiveMetadataSection,
    DisplayableMetadata,
    DisplayableMetadataBase,
    InternalItem,
    isTopLevelKey,
    LogicalStructureNode,
    MetadataContainer,
    Page as InternalPage,
    TopLevelDescriptiveMetadataProperties,
} from "../../../../internal-item-types";
import {
    DescriptionAttribute,
    DescriptionSection,
    Item,
    ItemData,
    ItemDescriptions,
    ItemPages,
    ItemResource,
    Page,
} from "../../../../item-types";
import { Namespace } from "../../../../uris";
import { Identified, identify } from "../../../../util/identified";
import {
    isNotUndefined,
    sortKeyTupleFuncToScalarFuncs,
} from "../../../../utils";
import {
    DescriptionTitlePlugin,
    IIIFPageResourcePlugin,
    InlineNamespacePlugin,
} from "./handlers";

/** Hooks available in the context of the conversion of a specific item. */
export class ItemToInternalItemConversionHooks {
    public static withDefaultTaps(): ItemToInternalItemConversionHooks {
        return new ItemToInternalItemConversionHooks();
    }

    /**
     * Invoked to create a Namespace from an Item.
     *
     * The first handler receives undefined as the namespace, and should return the namespace to use. Subsequent
     * handlers receive the namespace returned by preceding handlers.
     */
    public readonly createNamespace = new AsyncSeriesWaterfallHook<
        [Namespace?],
        Namespace
    >(["namespace"]);

    /**
     * Invoked with the internal JSON Page that was created from a package JSON Page.
     */
    public readonly page = new AsyncSeriesWaterfallHook<
        [InternalPage, Identified<Page>]
    >(["internalPage", "packagePage"]);

    /**
     * A map of hooks invoked to convert page resources to internal item pages.
     * For each resource two hooks are called: '*' and the expanded @type URI of the resource.
     */
    public readonly pageResource = new HookMap(
        () =>
            new AsyncSeriesWaterfallHook<[InternalPage, PageResourceContext]>([
                "internalPage",
                "context",
            ])
    );

    /**
     * Invoked when a [[DescriptionSection]]'s coverage is invalid.
     *
     * Handlers can return true to ignore the error; throw their own error; or return undefined to have a default error
     * be thrown.
     */
    public readonly invalidDescriptionCoverage = new SyncBailHook<
        [PageReferenceError, DescriptionSection],
        true | undefined
    >(["error", "description"]);

    public readonly descriptionTitle = new SyncBailHook<
        [DescriptionSection],
        string | undefined
    >(["description"]);

    /**
     * A map of hooks invoked to handle item data resources. Handlers receive the internal item created from the
     * standard package item properties, and the item data resource being handled. Handlers may augment the internal
     * item with additional information they can infer from the data resource, and or return a new internal item.
     *
     * For each item data resource found two hooks are called: '*' and the expanded @type URI of the data resource.
     */
    public readonly itemData = new HookMap(
        () =>
            new AsyncSeriesWaterfallHook<[InternalItem, ItemData, Namespace]>([
                "internalItem",
                "data",
                "namespace",
            ])
    );

    /**
     * Invoked immediately prior to returning the generated internal item. Handlers can modify the internal item, and or
     * return a new value to use.
     */
    public readonly postprocess = new AsyncSeriesWaterfallHook<
        [InternalItem, Namespace]
    >(["internalItem", "namespace"]);
}

export interface PageResourceContext {
    resource: ItemResource;
    page: Page;
    namespace: Namespace;
}

interface Plugin {
    apply(target: ItemToInternalItemConverter): void;
}

export class ItemToInternalItemConverter {
    public static readonly DEFAULT_PLUGINS: Set<Plugin> = new Set([
        new DescriptionTitlePlugin(),
        new IIIFPageResourcePlugin(),
        new InlineNamespacePlugin(),
    ]);

    public static withDefaultPlugins() {
        const converter = new ItemToInternalItemConverter();
        for (const plugin of ItemToInternalItemConverter.DEFAULT_PLUGINS) {
            plugin.apply(converter);
        }
        return converter;
    }

    public readonly hooks = {
        /**
         * Triggered at the start of each conversion operation initiated by calls to [[convert]]. Handlers gain access
         * to conversion-specific hooks to customise the upcoming conversion operation.
         */
        conversion: new SyncHook<[ItemToInternalItemConversionHooks, Item]>([
            "conversion",
            "item",
        ]),
    };

    public async convert(item: Item): Promise<InternalItem> {
        const conversionHooks =
            ItemToInternalItemConversionHooks.withDefaultTaps();
        this.hooks.conversion.call(conversionHooks, item);

        return await itemToInternalItem(item, conversionHooks);
    }
}

export function isItemToInternalItemConverter(
    value: unknown
): value is ItemToInternalItemConverter {
    return (
        value instanceof ItemToInternalItemConverter ||
        (typeof value === "object" &&
            (value as Partial<ItemToInternalItemConverter>).convert !==
                undefined &&
            (value as Partial<ItemToInternalItemConverter>).hooks !== undefined)
    );
}

async function itemToInternalItem(
    item: Item,
    hooks: ItemToInternalItemConversionHooks
): Promise<InternalItem> {
    let ns = await hooks.createNamespace.promise(undefined);
    if (ns === undefined) ns = Namespace.fromNamespaceMap({});

    const pages: InternalPage[] = await itemPagesToInternalItemPages(
        item.pages,
        ns,
        hooks
    );
    const logicalStructures: LogicalStructureNode[] = createLogicalStructures(
        item.descriptions,
        item.pages,
        hooks
    );
    const descriptiveMetadata = createDescriptiveMetadata(item.descriptions);

    let internalItem: InternalItem = {
        descriptiveMetadata,
        logicalStructures,
        pages,
    };

    // Allow handlers to augment the item based on item data
    for (const data of item.data || []) {
        for (const key of [ns.getExpandedUri(data["@type"]), "*"]) {
            const hook = hooks.itemData.get(key);
            if (hook !== undefined)
                internalItem = await hook.promise(internalItem, data, ns);
        }
    }

    // Give handlers a final opportunity to modify the conversion result
    return await hooks.postprocess.promise(internalItem, ns);
}

async function itemPagesToInternalItemPages(
    pages: ItemPages,
    namespace: Namespace,
    hooks: ItemToInternalItemConversionHooks
): Promise<InternalPage[]> {
    const orderedPages = fp.sortBy(scalarPageSortKeys, identify(pages));
    return await Promise.all(
        orderedPages.map((p, i) => pageToInternalPage(i, p, namespace, hooks))
    );
}

async function pageToInternalPage(
    index: number,
    page: Identified<Page>,
    namespace: Namespace,
    hooks: ItemToInternalItemConversionHooks
): Promise<InternalPage> {
    let convertedPage: InternalPage = {
        physID: page[identify.id],
        label: page.label,
        sequence: index + 1,
    };

    for (const resource of page.resources || []) {
        const typeUri = namespace.getExpandedUri(resource["@type"]);
        for (const hook of [
            hooks.pageResource.get(typeUri),
            hooks.pageResource.get("*"),
        ]) {
            if (hook)
                convertedPage = await hook.promise(convertedPage, {
                    resource,
                    page,
                    namespace,
                });
        }
    }

    return await hooks.page.promise(convertedPage, page);
}

function pageSortKey(page: Identified<Page>): string[] {
    if (typeof page.order === "string") {
        return [page.order, page.label, page[identify.id]];
    }
    return [page.label, page[identify.id]];
}
const scalarPageSortKeys: Array<(page: Identified<Page>) => string> =
    sortKeyTupleFuncToScalarFuncs(pageSortKey, 3);

function createLogicalStructures(
    descriptions: ItemDescriptions,
    pages: ItemPages,
    hooks: ItemToInternalItemConversionHooks
): LogicalStructureNode[] {
    const _pages = fp.sortBy(scalarPageSortKeys, identify(pages));
    if (_pages.length === 0) {
        return [];
    }

    const idDescriptions = identify(descriptions);
    let resolvedDescriptions: AbsCoverageDescriptionSection[] = fp
        .zip(
            idDescriptions,
            resolvePageReferencesToIndexes(idDescriptions, _pages)
        )
        .map(
            ([description, absCoverage]):
                | AbsCoverageDescriptionSection
                | undefined => {
                if (description === undefined)
                    throw new Error("desc was undefined");
                if (absCoverage === undefined)
                    throw new Error("absCoverage was undefined");

                if (isAbsPageRange(absCoverage))
                    return { ...description, absCoverage };

                if (
                    hooks.invalidDescriptionCoverage.call(
                        absCoverage,
                        description
                    ) !== true
                )
                    throw new Error(
                        `Invalid description coverage: ${absCoverage.message}`
                    );
            }
        )
        .filter(isNotUndefined);

    resolvedDescriptions = fp.orderBy(
        [
            (desc) => desc.absCoverage.firstPage,
            (desc) => desc.absCoverage.length,
        ],
        ["asc", "desc"],
        resolvedDescriptions
    );

    const logicalStructures: LogicalStructureNode[] = [];

    for (const desc of resolvedDescriptions) {
        const node = createLogicalStructure(desc, _pages, hooks);
        insertLogicalStructureNode(logicalStructures, node);
    }

    return logicalStructures;
}

function createLogicalStructure(
    description: AbsCoverageDescriptionSection,
    pages: Array<Identified<Page>>,
    hooks: ItemToInternalItemConversionHooks
): LogicalStructureNode {
    if (description.absCoverage.length < 1)
        throw new Error("Description coverage covers 0 pages");

    const startPageIndex = description.absCoverage.firstPage;
    const endPageIndex = startPageIndex + description.absCoverage.length - 1;
    const startPage = pages[startPageIndex];
    const endPage = pages[endPageIndex];

    if (startPage === undefined || endPage === undefined)
        throw new Error(
            "description absolute coverage page index out of range"
        );

    return {
        descriptiveMetadataID: description[identify.id],
        label: hooks.descriptionTitle.call(description) || "Untitled",
        startPagePosition: startPageIndex + 1,
        startPageLabel: startPage.label,
        startPageID: startPage[identify.id],
        endPagePosition: endPageIndex + 1,
        endPageLabel: endPage.label,
        endPageID: endPage[identify.id],
    };
}

function insertLogicalStructureNode(
    nodes: LogicalStructureNode[],
    node: LogicalStructureNode
): void {
    // This function is always called with nodes in ascending sequence, so the node to insert is either overlapping
    // or after the last-inserted node.
    assert(
        nodes.length === 0 ||
            node.startPagePosition >= nodes[nodes.length - 1].startPagePosition
    );

    // See if there's already a node that the inserted node fits inside. If so we insert the node as a child of the
    // existing node. There can be > 1 existing node at the end of the nodes list that could act as a parent of the
    // inserted node. We always insert into the earliest (lowest index) parent.
    let earliestParentIndex;
    for (
        let i = nodes.length - 1;
        i >= 0 &&
        node.startPagePosition >= nodes[i].startPagePosition &&
        node.endPagePosition <= nodes[i].endPagePosition;
        --i
    ) {
        earliestParentIndex = i;
    }
    if (earliestParentIndex !== undefined) {
        const parentNode = nodes[earliestParentIndex];
        parentNode.children = parentNode.children || [];
        insertLogicalStructureNode(parentNode.children, node);
        return;
    }

    nodes.push(node);
}

type IDDescriptionSection = Identified<DescriptionSection>;
type IDPage = Identified<Page>;

interface AbsPageRange {
    firstPage: number;
    length: number;
}

function isAbsPageRange(obj: any): obj is AbsPageRange {
    return typeof obj.length === "number" && typeof obj.firstPage === "number";
}

interface PageReferenceError {
    message: string;
    description: IDDescriptionSection;
}

interface AbsCoverageDescriptionSection extends Identified<DescriptionSection> {
    absCoverage: AbsPageRange;
}

function resolvePageReferencesToIndexes(
    descriptions: IDDescriptionSection[],
    pages: IDPage[]
): Array<AbsPageRange | PageReferenceError> {
    const indexIndex = indexPages(pages);

    return descriptions.map(
        (desc: IDDescriptionSection): AbsPageRange | PageReferenceError => {
            const first = desc.coverage.firstPage;
            const last = desc.coverage.lastPage;
            const absFirst = first === true ? 0 : indexIndex.get(first);
            if (absFirst === undefined)
                return {
                    message: `\
/descriptions/${
                        desc[identify.id]
                    }/coverage/firstPage references a page that doesn't exist: ${first}`,
                    description: desc,
                };

            const absLast =
                last === true ? pages.length - 1 : indexIndex.get(last);
            if (absLast === undefined)
                return {
                    message: `\
/descriptions/${
                        desc[identify.id]
                    }/coverage/lastPage references a page that doesn't exist: ${last}`,
                    description: desc,
                };
            const length = absLast + 1 - absFirst;
            if (length < 1)
                return {
                    message: `\
/descriptions/${
                        desc[identify.id]
                    }/coverage/firstPage (${first} = ${absFirst}) is after lastPage \
(${last} = ${absLast})`,
                    description: desc,
                };

            return { firstPage: absFirst, length };
        }
    );
}

function indexPages(pages: IDPage[]): Map<string, number> {
    return new Map(pages.map((page, index) => [page[identify.id], index]));
}

export function createDescriptiveMetadata(
    descriptions: ItemDescriptions
): DescriptiveMetadataSection[] {
    return fp
        .sortBy(scalarDescriptionSectionSortKeys, identify(descriptions))
        .map(_createDescriptiveMetadataSection);
}

function _createDescriptiveMetadataSection(
    description: Identified<DescriptionSection>
): DescriptiveMetadataSection {
    const metadataProps: MetadataContainer = identify.index(
        fp
            .sortBy(
                scalarDescriptionAttributeSortKeys,
                identify(description.attributes || {})
            )
            .map(createDisplayableMetadata)
    );

    // Prevent display properties from using top-level metadata keys
    for (const reservedKey of Object.keys(metadataProps).filter(
        isTopLevelKey
    )) {
        let unreservedKey: string = reservedKey;
        do {
            unreservedKey = `_${unreservedKey}`;
        } while (metadataProps.hasOwnProperty(unreservedKey));
        metadataProps[unreservedKey] = metadataProps[reservedKey];
        delete metadataProps[reservedKey];
    }

    // TODO: May want to provide a hook to create additional properties here, as we're not in a position to create the
    //       assorted properties supported by TopLevelDescriptiveMetadataProperties. Alternatively hooks handling
    //       item-level data can populate these properties after we've created this skeleton.
    const topLevel: TopLevelDescriptiveMetadataProperties = {
        ID: description[identify.id],
    };
    return createDescriptiveMetadataSection(topLevel, metadataProps);
}

function createDisplayableMetadata(
    attribute: Identified<DescriptionAttribute>,
    index: number
): Identified<DisplayableMetadata> {
    const base: Identified<DisplayableMetadataBase> = {
        [identify.id]: attribute[identify.id],
        display: true,
        seq: index + 1,
        label: attribute.label,
    };

    if (typeof attribute.value === "string") {
        return {
            ...base,
            displayForm: attribute.value,
        };
    } else {
        return {
            ...base,
            value: attribute.value.map((v) => ({ displayForm: v })),
        };
    }
}

const scalarDescriptionSectionSortKeys: Array<
    (description: Identified<DescriptionSection>) => number | string
> = sortKeyTupleFuncToScalarFuncs(descriptionSectionSortKey, 2);

function descriptionSectionSortKey(
    description: Identified<DescriptionSection>
): [number, string] {
    return [
        description[identify.id] === "main" ? 0 : 1,
        description[identify.id],
    ];
}

const scalarDescriptionAttributeSortKeys: Array<
    (attr: Identified<DescriptionAttribute>) => string
> = [
    (attr) => (attr.order === undefined ? attr[identify.id] : attr.order),
    (attr) => attr[identify.id],
];

/**
 * @deprecated Don't use these apart from when testing.
 */
export const _internals = {
    createDescriptiveMetadata,
    createLogicalStructures,
    itemPagesToInternalItemPages,
};
