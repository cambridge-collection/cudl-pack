import parseJson from 'json-parse-better-errors';
import {ValidationOptions} from './schemas';

import {validateInternalItem} from './schemas';

export function parseInternalItemJson(json: string, options?: ValidationOptions) {
    const object = parseJson(json);
    validateInternalItem(object, options);

    return object;
}
