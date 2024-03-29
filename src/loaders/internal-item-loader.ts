import webpack from 'webpack';
import {parseInternalItemJson} from '../internal-item';

const loader: webpack.loader.Loader = (source: string) => {
    // This just serves to ensure the input is valid
    parseInternalItemJson(source);

    return source;
};

export default loader;
