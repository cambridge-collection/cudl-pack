import Ajv from 'ajv';
import {DocumentFile, XsltTransformer} from 'cudl-node-xslt-java-bridge';
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

async function load(this: webpack.loader.LoaderContext, source: string): Promise<string> {
    const options: Options = validateOptions(loaderUtils.getOptions(this) || {});

    const stylesheetPath = await promisify(this.resolve.bind(this))(this.rootContext, options.stylesheet);

    const transformer = new XsltTransformer(stylesheetPath);
    const transform = promisify<DocumentFile, DocumentFile[]>(transformer.transform.bind(transformer));

    const document: DocumentFile = {
        base: this.context,
        path: this.resourcePath,
        contents: source,
    };
    const results: DocumentFile[] = await transform(document);

    if(results.length !== 1) {
        throw new Error(`Expected 1 result from XSLT transform but got ${results.length}`);
    }
    const [{contents}] = results;
    return contents;
}

export default createAsyncLoader(load);
