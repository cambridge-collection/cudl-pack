import parseJson from 'json-parse-better-errors';
import {ValidationOptions} from './schemas';

import {validateItem} from './schemas';

export function parseItemJson(json: string, options?: ValidationOptions) {
    const object = parseJson(json);
    validateItem(object, options);

    return object;
}
