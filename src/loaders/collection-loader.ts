import webpack from 'webpack';
import {parseCollectionJson} from '../collection';

const loader: webpack.loader.Loader = (source: string | Buffer) => {
    // This just serves to ensure the input is valid
    parseCollectionJson(source.toString());

    return source;
};

export default loader;
