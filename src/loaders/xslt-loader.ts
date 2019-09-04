import {execute} from '@lib.cam/xslt-nailgun';
import Ajv from 'ajv';
import loaderUtils from 'loader-utils';
import {promisify} from 'util';
import webpack from 'webpack';
import {createValidator} from '../schemas';
import {createAsyncLoader} from '../utils';
import optionsSchema from './xslt-loader-options.schema.json';

interface Options {
    stylesheet: string;
}

const validateOptions = createValidator<Options>({
    schemaId: optionsSchema.$id,
    validate: new Ajv().compile(optionsSchema),
    name: 'options',
});

async function load(this: webpack.loader.LoaderContext, source: string): Promise<Buffer> {
    const options: Options = validateOptions(loaderUtils.getOptions(this) || {});

    const stylesheetPath = await promisify(this.resolve.bind(this))(this.rootContext, options.stylesheet);

    // TODO: Maintain an executor instance for the lifetime of a build. Using
    //  execute() directly will share a JVM if multiple execute() calls overlap,
    //  but they happen serially then a new JVM will be spawned for each call,
    //  which will be slow.
    return await execute(this.resourcePath, source, stylesheetPath);
}

export default createAsyncLoader<string | Buffer>(load);
