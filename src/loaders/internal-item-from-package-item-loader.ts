import objectFromEntries from 'object.fromentries';
import webpack from 'webpack';
import {isItemToInternalItemConverter, ItemToInternalItemConverter} from '../convert/item/to/internal-item';
import {generateInternalItemJson} from '../internal-item';
import {parseItemJson} from '../item';
import {Item} from '../item-types';
import {createAsyncLoader} from '../utils';

interface Options {
    postValidate: boolean;
    converter: ItemToInternalItemConverter;
}
type ExternalOptions = Partial<Options>;

function getOptions(context: webpack.LoaderContext<{}>): Options {
    const options = context.getOptions() as Record<keyof Options, unknown>;

    const postValidate = options.postValidate;
    if(postValidate !== undefined && typeof postValidate !== 'boolean') {
        throw new Error(`postValidate option must be a boolean`);
    }

    const converter = options.converter;
    if (!(converter === undefined || isItemToInternalItemConverter(converter))) {
        throw new Error(`converter option must be a ItemToInternalItemConverter object`);
    }

    return {
        postValidate: postValidate === undefined ? true : postValidate,
        converter: converter || ItemToInternalItemConverter.withDefaultPlugins(),
        ...objectFromEntries(Object.entries(options).filter(([, value]) => value !== undefined)),
    };
}

export default createAsyncLoader(async function (this, source) {
    const options = getOptions(this);
    const item: Item = parseItemJson(source.toString());
    const internalItem = await options.converter.convert(item);

    return generateInternalItemJson(internalItem, {validate: options.postValidate});
});

export {ExternalOptions as InternalItemfromPackageItemLoaderOptions};
