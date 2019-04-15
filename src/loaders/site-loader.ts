import {urlToRequest} from 'loader-utils';
import {promisify} from 'util';
import webpack from 'webpack';
import {parseSiteJson} from '../site';
import {bindPromiseToCallback} from '../utils';

const loader: webpack.loader.Loader = function(source: string) {
    bindPromiseToCallback(load.call(this, source), this.async());
}

async function load(this: webpack.loader.LoaderContext, source: string): Promise<string> {
    const site = parseSiteJson(source);

    await Promise.all(site.collections.map((collectionRef) => {
        const req = urlToRequest(collectionRef.href);
        return promisify(this.resolve)(this.context, req)
            .then((path) => {
                this.addDependency(path);
            });
    }));

    return JSON.stringify(site);
}

export default loader;
