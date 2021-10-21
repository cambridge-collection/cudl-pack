import parseJson from "json-parse-better-errors";
import { InternalItem } from "./internal-item-types";
import { ValidationOptions } from "./schemas";

import { validateInternalItem } from "./schemas";

export function parseInternalItemJson(
    json: string,
    options?: ValidationOptions
): InternalItem {
    const object: unknown = parseJson(json);
    return validateInternalItem(object, options);
}

interface GenerateOptions {
    validate?: boolean;
    indent?: number | string;
}
export function generateInternalItemJson(
    internalItem: InternalItem,
    options?: GenerateOptions
) {
    const _options = options || {};
    if (_options.validate !== false) {
        validateInternalItem(internalItem);
    }
    return JSON.stringify(internalItem, undefined, _options.indent);
}
