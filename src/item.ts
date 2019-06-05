import parseJson from 'json-parse-better-errors';
import {Item} from './item-types';
import {validateItem, ValidationOptions} from './schemas';

export function parseItemJson(json: string, options?: ValidationOptions): Item {
    const object: unknown = parseJson(json);

    return validateItem(object, options);
}

export function generateItemJson(item: Item): string {
    // Ensure the output has a @type attribute, as it's optional on Item interface
    const itemWithType: Item = Object.assign(
        {}, item, {'@type': 'https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json'});

    return JSON.stringify(itemWithType);
}
