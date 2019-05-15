import webpack from 'webpack';
import {parseDlDatasetJson} from '../dl-dataset';

const loader: webpack.loader.Loader = (source: string) => {
    // This just serves to ensure the input is valid dl-dataset JSON
    parseDlDatasetJson(source);

    return source;
};

export default loader;
