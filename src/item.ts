import parseJson from 'json-parse-better-errors';
import {Item} from './item-types';
import {validateItem, ValidationOptions} from './schemas';

export function parseItemJson(json: string, options?: ValidationOptions): Item {
    const object: unknown = parseJson(json);

    return validateItem(object, options);
}

export function generateItemJson(item: Item): string {
    return JSON.stringify(item);
}
