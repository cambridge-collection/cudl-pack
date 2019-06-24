import Ajv from 'ajv';
import loaderUtils from 'loader-utils';
import {promisify} from 'util';
import webpack from 'webpack';
import {createValidator} from '../schemas';
import {createAsyncLoader} from '../utils';
import {apply} from '../xslt-transformations';
import optionsSchema from './xslt-loader-options.schema.json';

interface Options {
    stylesheet: string;
}

const validateOptions = createValidator<Options>({
    schemaId: optionsSchema.$id,
    validate: new Ajv().compile(optionsSchema),
    name: 'options',
});

async function load(this: webpack.loader.LoaderContext, source: string): Promise<string> {
    const options: Options = validateOptions(loaderUtils.getOptions(this) || {});

    const stylesheetPath = await promisify(this.resolve.bind(this))(this.rootContext, options.stylesheet);

    return await apply(this.context, this.resourcePath, source, stylesheetPath);
}

export default createAsyncLoader(load);
