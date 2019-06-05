import parseJson from 'json-parse-better-errors';
import {ItemJson} from './item-types';
import {validateItem, ValidationOptions} from './schemas';

export function parseItemJson(json: string, options?: ValidationOptions): ItemJson {
    const object: unknown = parseJson(json);

    return validateItem(object, options);
}

export function generateItemJson(item: ItemJson): string {
    // Ensure the output has a @type attribute, as it's optional on ItemJson interface
    const itemWithType: ItemJson = Object.assign(
        {}, item, {'@type': 'https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json'});

    return JSON.stringify(itemWithType);
}
