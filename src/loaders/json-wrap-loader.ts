import clone from 'clone';
import jsonpointer from 'jsonpointer';
import {getOptions} from 'loader-utils';
import validateOptions from 'schema-utils';
import webpack from 'webpack';

const optionsSchema = {
    type: 'object',
    properties: {
        insertionPoint: { type: 'string' },
        template: { type: ['object', 'array'] },
    },
    required: ['insertionPoint'],
};

interface Options {
    insertionPoint: string;
    template?: object;
}

/**
 * A loader which nests the loaded value into a JSON structure
 */
export default function(this: webpack.loader.LoaderContext, source: string) {
    const options = getOptions(this) || {} as Options;
    validateOptions(optionsSchema, options, 'json-wrap-loader');

    const template = clone(options.template || {}, false);
    jsonpointer.set(template, options.insertionPoint, JSON.parse(source));
    return JSON.stringify(template);
}
