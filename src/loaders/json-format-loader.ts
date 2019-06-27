import Ajv from 'ajv';
import parseJson from 'json-parse-better-errors';
import loaderUtils from 'loader-utils';
import * as util from 'util';
import webpack from 'webpack';
import {createValidator} from '../schemas';
import optionsSchema from './json-format-loader-options.schema.json';

interface Options {
    /** An int 0-10 or string with 0-10 tabs and or spaces. */
    indent?: number | string;
    /** Whether to insert a newline after the end of the JSON doc. Default: yes if the doc is indented. */
    finalNewline?: boolean;
}

const validateOptions = createValidator<Options>({
    schemaId: optionsSchema.$id,
    validate: new Ajv().compile(optionsSchema),
    name: 'options',
});

/**
 * A loader which re-indents JSON.
 */
export default function(this: webpack.loader.LoaderContext, source: string): string {
    const options: Options = validateOptions(loaderUtils.getOptions(this || {}));
    if(options.indent !== undefined)
        validateIndent(options.indent);
    const finalNewline = options.finalNewline === undefined ? !!options.indent : options.finalNewline;

    return JSON.stringify(parseJson(source), undefined, options.indent) + (finalNewline ? '\n' : '');
}

function validateIndent(indent: number | string) {
    if(typeof indent === 'string' && /^[ \t]{0,10}$/.test(indent))
            return;
    else if(typeof indent === 'number') {
        if(Number.isInteger(indent) && indent >= 0 && indent < 11)
            return;
    }

    throw new Error(`\
indent option must be an integer >= 0 and <= 10, or an equivalent length string containing only tabs and or spaces; \
got: ${util.inspect(indent)}`);
}
