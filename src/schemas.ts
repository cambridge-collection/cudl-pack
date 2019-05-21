import Ajv from 'ajv';
import url from 'url';

import collectionSchema from './schemas/collection.json';
import commonSchema from './schemas/common.json';

const base = 'https://schemas.cudl.lib.cam.ac.uk/package/v1/';
const commonId = url.resolve(base, 'common.json');
const collectionId = url.resolve(base, 'collection.json');

const ajv = new Ajv();
ajv.addSchema(commonSchema, url.resolve(base, commonId));
ajv.addSchema(collectionSchema, url.resolve(base, collectionId));

export interface ValidationOptions {
    /**
     * A description of the thing being validated, e.g. the file path it originated from.
     *
     * @default 'input'
     */
    inputDescription?: string;
    /**
     * Produce more verbose error messages.
     *
     * Currently this results in the path to the failed schema rule being included in error messages.
     * @default true
     */
    verbose?: boolean;
}

function defaultValidationOptions(opts?: ValidationOptions) {
    opts = opts || {};
    return {
        inputDescription: opts.inputDescription || 'input',
        verbose: opts.hasOwnProperty('verbose') ? opts.verbose : true,
    };
}

function expectValid(this: {schemaId: string, validate: Ajv.ValidateFunction, name: string},
                     obj: any, options?: ValidationOptions): void {
    options = defaultValidationOptions(options);
    const inputDescription = options.inputDescription;
    const valid = this.validate(obj);
    if(!valid) {
        const errors = this.validate.errors.map((e) => errorMessage(e, this.name, options.verbose));

        const msg = options.verbose ?
            '\n' + errors.map((e) => '  - ' + e).join('\n') :
            ' ' + errors.join('; ');

        const schemaName = options.verbose ? this.schemaId : this.name;
        throw new Error(`${inputDescription} does not match the ${schemaName} schema:${msg}`);
    }
}

function errorMessage(errorObject: Ajv.ErrorObject, name: string, includeSchemaPath: boolean): string {
    const msg = `${name}${errorObject.dataPath} ${errorObject.message}`;

    if(includeSchemaPath) {
        return `${msg} (${errorObject.schemaPath})`;
    }
    return msg;
}

function createValidator(schemaId: string, name: string) {
    return expectValid.bind({schemaId, validate: ajv.getSchema(schemaId), name});
}

export const validateCollection = createValidator(collectionId, 'collection');
