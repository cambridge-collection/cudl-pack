import parseJson from 'json-parse-better-errors';
import {InternalItem} from './internal-item-types';
import {ValidationOptions} from './schemas';

import {validateInternalItem} from './schemas';

export function parseInternalItemJson(json: string, options?: ValidationOptions): InternalItem {
    const object: unknown = parseJson(json);
    return validateInternalItem(object, options);
}
