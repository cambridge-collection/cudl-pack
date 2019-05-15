import webpack from 'webpack';
import {parseDlDatasetXml} from '../dl-dataset';
import {bindPromiseToCallback} from '../utils';

const loader: webpack.loader.Loader = function(source: string) {
    bindPromiseToCallback(load.call(this, source), this.async());
};

async function load(this: webpack.loader.LoaderContext, source: string): Promise<string> {
    return await parseDlDatasetXml(source)
        .then(JSON.stringify);
}

export default loader;
