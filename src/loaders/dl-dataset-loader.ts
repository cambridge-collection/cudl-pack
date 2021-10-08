import webpack from 'webpack';
import {parseDlDatasetJson} from '../dl-dataset';

const loader: webpack.loader.Loader = (source: string | Buffer) => {
    // This just serves to ensure the input is valid dl-dataset JSON
    parseDlDatasetJson(source.toString());

    return source;
};

export default loader;
