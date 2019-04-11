import {RawSourceMap} from 'source-map';
import webpack from 'webpack';
import LoaderContext = webpack.loader.LoaderContext;

interface PromiseLoader extends webpack.loader.Loader {
    (this: LoaderContext, source: string | Buffer, sourceMap?: RawSourceMap):
        Promise<string | Buffer> | string | Buffer | void | undefined;
}

export function promiseLoader(pl: PromiseLoader): webpack.loader.Loader {
    return (source, sourceMap) => {
        const result = pl.call(this, source, sourceMap);

        if(result instanceof Promise) {
            const callback = this.async();
            result.then((value) => { callback(null, value); }, callback);
        }
        else {
            return result;
        }
    };
}
