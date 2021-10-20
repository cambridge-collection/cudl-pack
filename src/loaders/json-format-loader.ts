import Ajv from 'ajv';
import parseJson from 'json-parse-better-errors';
import * as util from 'util';
import webpack from 'webpack';
import {createValidator} from '../schemas';
import optionsSchema from './json-format-loader-options.schema.json';

export interface Options {
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
export default function(this: webpack.LoaderContext<{}>, source: string): string {
    const options: Options = normaliseOptions(validateOptions(this.getOptions()));
    return JSON.stringify(parseJson(source), undefined, options.indent) + (options.finalNewline ? '\n' : '');
}

function normaliseOptions(options: Options): Options {
    let indent = options.indent;
    let normalisedIndent;
    if(typeof indent === 'string') {
        if(/^[ \t]{0,10}$/.test(indent))
            normalisedIndent = indent;
        else if(/^[\d+]$/.test(indent))
            indent = parseInt(indent, 10);
    }
    if(typeof indent === 'number') {
        if(Number.isInteger(indent) && indent >= 0 && indent < 11)
            normalisedIndent = indent;
    }
    if(indent === undefined)
        normalisedIndent = 0;

    if(normalisedIndent === undefined) {
        throw new Error(`\
indent option must be an integer >= 0 and <= 10, or an equivalent length string containing only tabs and or spaces; \
got: ${util.inspect(indent)}`);
    }

    return {
        indent: normalisedIndent,
        finalNewline: options.finalNewline === undefined ? !!normalisedIndent : options.finalNewline,
    };
}
