import webpack from 'webpack';
import {parseSiteXml} from '../site';
import {bindPromiseToCallback} from '../utils';

const loader: webpack.loader.Loader = function(source: string) {
    bindPromiseToCallback(load.call(this, source), this.async());
};

async function load(this: webpack.loader.LoaderContext, source: string): Promise<string> {
    return await parseSiteXml(source)
        .then(JSON.stringify);
}

export default loader;
