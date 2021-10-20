import webpack from 'webpack';
import {parseInternalItemJson} from '../internal-item';

const loader: webpack.LoaderDefinitionFunction = (source: string | Buffer) => {
    // This just serves to ensure the input is valid
    parseInternalItemJson(source.toString());

    return source;
};

export default loader;
