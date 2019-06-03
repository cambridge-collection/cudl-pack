import webpack from 'webpack';
import {parseItemJson} from '../item';

const loader: webpack.loader.Loader = (source: string) => {
    // This just serves to ensure the input is valid
    parseItemJson(source);

    return source;
};

export default loader;
