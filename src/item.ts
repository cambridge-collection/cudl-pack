import parseJson from 'json-parse-better-errors';
import {ValidationOptions} from './schemas';

import {validateItem} from './schemas';

export function parseItemJson(json: string, options?: ValidationOptions): ItemJson {
    const object = parseJson(json);
    validateItem(object, options);

    return object;
}

export function generateItemJson(item: ItemJson): string {
    // Ensure the output has a @type attribute, as it's optional on ItemJson interface
    const itemWithType: ItemJson = Object.assign(
        {}, item, {'@type': 'https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json'});

    return JSON.stringify(itemWithType);
}

export type ItemPropertyScalar = string | boolean | number;
export type ItemProperty = ItemPropertyScalar | ItemPropertyScalar[];
export interface ItemProperties { [key: string]: ItemProperty; }

export interface PageImage {
    /** The type of image resource identified by the [[href]] URL. */
    type: string;

    /** The location of the image as a URL. */
    href: string;
}

export interface Page {
    label: string;
    order?: string;
    image: PageImage;
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
export interface ItemJson {
    '@type'?: 'https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json';
    properties: ItemProperties;
    descriptions: ItemDescriptions;
    pages: ItemPages;
}
