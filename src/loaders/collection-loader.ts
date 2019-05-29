import webpack from 'webpack';
import {parseCollectionJson} from '../collection';

const loader: webpack.loader.Loader = (source: string) => {
    // This just serves to ensure the input is valid collection JSON
    parseCollectionJson(source);

    return source;
};

export default loader;
