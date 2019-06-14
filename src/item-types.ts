import {CDLType, Namespace, TypeUri} from './uris';

export type ItemPropertyScalar = string | boolean | number;
export type ItemProperty = ItemPropertyScalar | ItemPropertyScalar[];
export interface ItemProperties { [key: string]: ItemProperty; }

export interface UriReference {
    '@id': string;
}

export interface TypeBearer {
    '@type': string;
}

export interface RoleBearer {
    '@role'?: string[];
}

export interface NamespaceMap {
    [key: string]: string;
}

export interface NamespaceBearer {
    '@namespace'?: string | NamespaceMap;
}

export interface ItemData extends TypeBearer, RoleBearer { }

export interface LinkItemData extends ItemData {
    href: string;
}

export type PropertiesItemData = ItemData | ItemProperties;

export interface ItemResource extends TypeBearer {
    [key: string]: unknown;
}

export interface ImageItemResource extends TypeBearer {
    /** The type of image resource identified by the [[image]] URL. */
    imageType: string;
    /** The location of the image as a URL. */
    image: UriReference;
}

export function isImageItemResource(resource: ItemResource, ns: Namespace): resource is ImageItemResource {
    return ns.getExpandedUri(resource['@type']) === CDLType.Image;
}

export interface TranscriptionItemResource extends TypeBearer {
    transcriptionType: string;
    html: UriReference;
}

export interface TranslationItemResource extends TypeBearer {
    html: UriReference;
}

export interface Page {
    label: string;
    order?: string;
    resources?: ItemResource[];
}

/** A mapping of page IDs to [[Page]]s. */
export interface ItemPages {
    [key: string]: Page;
}

export type PageReference = string | true;

export interface PageRange {
    firstPage: PageReference;
    lastPage: PageReference;
}

export interface DescriptionAttribute {
    label: string;
    value: string | string[];
    order?: string;
}

export interface DescriptionAttributes {
    [key: string]: DescriptionAttribute;
}

export interface DescriptionSection {
    coverage: PageRange;
    attributes?: DescriptionAttributes;
}

export interface ItemDescriptions {
    main: DescriptionSection;
    [key: string]: DescriptionSection;
}

/**
 * A CDL Package JSON Item.
 */
export interface Item extends NamespaceBearer {
    '@type': TypeUri.PackageItem;
    data?: ItemData[];
    descriptions: ItemDescriptions;
    pages: ItemPages;
}
