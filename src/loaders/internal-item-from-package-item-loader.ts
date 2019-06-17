import loaderUtils from 'loader-utils';
import objectFromEntries from 'object.fromentries';
import webpack from 'webpack';
import {ItemToInternalItemConverter} from '../convert/item/to/internal-item';
import {generateInternalItemJson} from '../internal-item';
import {parseItemJson} from '../item';
import {Item} from '../item-types';
import {createAsyncLoader} from '../utils';

interface Options {
    postValidate: boolean;
    converter: ItemToInternalItemConverter;
}
type ExternalOptions = Partial<Options>;

function getOptions(context: webpack.loader.LoaderContext): Options {
    const options: Partial<Options> = loaderUtils.getOptions(context) || {};

    return {
        postValidate: true,
        converter: options.converter || ItemToInternalItemConverter.withDefaultPlugins(),
        ...objectFromEntries(Object.entries(options).filter(([, value]) => value !== undefined)),
    };
}

async function load(this: webpack.loader.LoaderContext, source: string): Promise<string> {
    const options = getOptions(this);
    const item: Item = parseItemJson(source);
    const internalItem = await options.converter.convert(item);

    return generateInternalItemJson(internalItem, {validate: options.postValidate});
}

export default createAsyncLoader(load);
export {ExternalOptions as InternalItemfromPackageItemLoaderOptions};
