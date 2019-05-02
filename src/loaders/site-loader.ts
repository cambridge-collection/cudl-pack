import webpack from 'webpack';
import {parseSiteJson} from '../site';

const loader: webpack.loader.Loader = (source: string) => {
    // This just serves to ensure the input is valid site JSON
    parseSiteJson(source);

    return source;
};

export default loader;
