import {execute} from '@lib.cam/xslt-nailgun';
import Ajv from 'ajv';
import loaderUtils from 'loader-utils';
import {URL} from 'url';
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

    // The JVM which execute() uses to run XSLT is kept alive for a short time between calls, so it shouldn't be
    // necessary to share an XSLTExecutor instance across loader invocations.
    return await execute({
        systemIdentifier: this.resourcePath,
        xml: source,
        xsltPath: stylesheetPath,
    });
}

export default createAsyncLoader<string | Buffer>(load);
