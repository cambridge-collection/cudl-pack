import parseJson from 'json-parse-better-errors';
import {ValidationOptions} from './schemas';

import {validateCollection} from './schemas';

export function parseCollectionJson(json: string, options?: ValidationOptions) {
    const object = parseJson(json);
    validateCollection(object, options);

    return object;
}
