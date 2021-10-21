import { enumMemberGuard } from "./utils";

export enum Orientation {
    Portrait = "portrait",
    Landscape = "landscape",
}

export enum TopLevelKeys {
    ID,
    thumbnailUrl,
    thumbnailOrientation,
    displayImageRights,
    downloadImageRights,
    imageReproPageURL,
    docAuthority,
    type,
    manuscript,
    itemReferences,
}
export const isTopLevelKey = enumMemberGuard(TopLevelKeys);

export interface TopLevelDescriptiveMetadataProperties {
    ID: string;
    thumbnailUrl?: string;
    thumbnailOrientation?: Orientation;
    displayImageRights?: string;
    downloadImageRights?: string;
    imageReproPageURL?: string;
    docAuthority?: string;
    type?: "text";
    manuscript?: boolean;
    itemReferences?: Array<{ ID: string }>;
}

export interface NestedMetadata {
    label?: never;
    value: MetadataContainer[];
    [key: string]: unknown;
}

export interface DisplayableMetadataBase {
    display: boolean;
    seq: number;
    label: string;
}

export interface SingleDisplayableMetadata {
    displayForm: string;
    linktype?: "keyword search";
    value?: never;

    // Additional arbitrary properties allowed
    [key: string]: unknown;
}

export interface MultipleDisplayableMetadata {
    value: SingleDisplayableMetadata[];
    displayForm?: never;

    // Additional arbitrary properties allowed
    [key: string]: unknown;
}

export type DisplayableMetadata = DisplayableMetadataBase &
    (SingleDisplayableMetadata | MultipleDisplayableMetadata);

enum MetadataKeys {
    display,
    displayForm,
    label,
    linktype,
    seq,
    value,
}
const isMetadataKey = enumMemberGuard(MetadataKeys);
type NotMetadataKeys = { [K in keyof MetadataKeys]?: never };

/** Anything except reserved metadata keys */
export type NonDisplayableMetadata = {
    [K in string]: unknown;
} & NotMetadataKeys;

export function isNonDisplayableMetadata(
    obj: unknown
): obj is NonDisplayableMetadata {
    return (
        typeof obj === "object" &&
        obj !== null &&
        !Object.keys(obj).some(isMetadataKey)
    );
}

export interface MetadataContainer {
    [key: string]:
        | NestedMetadata
        | DisplayableMetadata
        | NonDisplayableMetadata;
}

/**
 * The top-level descriptive metadata objects.
 *
 * **Warning:** TypeScript won't let you create DescriptiveMetadataSection instances directly, as the index signature of
 * MetadataContainer is incompatible with TopLevelDescriptiveMetadataProperties. (Top level allows strings, etc for the
 * properties it allows, which aren't allowed by general metadata properties.) Instead you can use
 * [[createDescriptiveMetadataSection]] to create instances.
 */
export type DescriptiveMetadataSection = TopLevelDescriptiveMetadataProperties &
    MetadataContainer;

/**
 * Create a DescriptiveMetadataSection from top-level properties and general metadata properties.
 *
 * This is a helper to work around the types being strictly incompatible (see [[DescriptiveMetadataSection]].
 */
export function createDescriptiveMetadataSection(
    topLevel: TopLevelDescriptiveMetadataProperties,
    metadata: MetadataContainer,
    strict = true
): DescriptiveMetadataSection {
    // Ensure we don't allow non top-level keys from metadata
    const allKeys = Object.keys(metadata);
    let _metadata;
    if (allKeys.some(isTopLevelKey)) {
        if (strict) {
            const reservedKeys = allKeys
                .filter((key) => !isTopLevelKey(key))
                .join(", ");
            throw new Error(`\
metadata contained a displayable object under a key reserved for top-level non-displayable metadata: ${reservedKeys}`);
        }

        // non-strict mode: Exclude reserved metadata from the result
        _metadata = allKeys
            .filter((member) => !isTopLevelKey(member))
            .map((member) => [member, metadata[member]]);
    } else {
        _metadata = metadata;
    }

    const result: unknown = {
        ..._metadata,
        ...topLevel,
    };
    return result as DescriptiveMetadataSection;
}

export interface Page {
    label: string;
    physID: string;
    sequence: number;
    displayImageURL?: string;
    downloadImageURL?: string;
    IIIFImageURL?: string;
    thumbnailImageURL?: string;
    thumbnailImageOrientation?: Orientation;
    imageWidth?: number;
    imageHeight?: number;
    transcriptionNormalisedURL?: string;
    transcriptionDiplomaticURL?: string;
    translationURL?: string;
    /** Used in itemType: essay to hold the text of the essay constituting the item */
    content?: string;
    pageType?: string;
}

export interface LogicalStructureNode {
    descriptiveMetadataID: string;
    endPagePosition: number;
    label: string;
    startPageLabel: string;
    startPagePosition: number;

    children?: LogicalStructureNode[];
    endPageID?: string;
    endPageLabel?: string;
    startPageID?: string;
}

export interface ListItemPage {
    fileID: string;
    dmdID: string;
    startPageLabel: string;
    startPage: number;
    title: string;
    listItemText: string;
}

export interface ItemProperties {
    textDirection?: "L" | "R";
    itemType?: "essay";
    numberOfPages?: number;
    embeddable?: boolean;
    sourceData?: string;
    useTranscriptions?: boolean;
    useNormalisedTranscriptions?: boolean;
    useDiplomaticTranscriptions?: boolean;
    allTranscriptionDiplomaticURL?: string;
    useTranslations?: boolean;
    completeness?: string;
}

export interface ItemStructure {
    descriptiveMetadata: DescriptiveMetadataSection[];
    pages: Page[];
    logicalStructures: LogicalStructureNode[];
    listItemPages?: ListItemPage[];
}

export type InternalItem = ItemProperties & ItemStructure;
