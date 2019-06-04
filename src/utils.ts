import {RawSourceMap} from 'source-map';
import webpack from 'webpack';

export function bindPromiseToCallback<T>(
    promise: Promise<T>, callback: (err: any, value?: T) => void): void {

    promise.then(
        (value) => { callback(null, value); }, callback);
}

type AsyncLoadFunction = (this: webpack.loader.LoaderContext, source: string | Buffer, sourceMap?: RawSourceMap) =>
    Promise<string | Buffer | void | undefined>;
type AsyncLoadMethod<T> = (this: T, context: webpack.loader.LoaderContext, source: string | Buffer,
                           sourceMap?: RawSourceMap) =>
    Promise<string | Buffer | void | undefined>;

/**
 * Create a normal webpack loader function from a promise-returning async function which takes an explicit context
 * argument.
 *
 * The difference with [[createAsyncLoader]] is that this doesn't require the use of the `this` arg, so class methods
 * can use it directly.
 */
export function createAsyncLoaderFromMethod<T>(load: AsyncLoadMethod<T>, thisArg?: T): webpack.loader.Loader {
    return function(this: webpack.loader.LoaderContext, source: string | Buffer, sourceMap?: RawSourceMap) {
        const callback = this.async();
        if(callback === undefined) {
            throw new Error('loader context returned no callback from async()');
        }

        return bindPromiseToCallback(load.call(thisArg, this, source, sourceMap), callback);
    };
}

/**
 * Create a normal webpack loader function from a promise-returning async
 * loader function.
 */
export function createAsyncLoader(load: AsyncLoadFunction): webpack.loader.Loader {
    return createAsyncLoaderFromMethod((context, source, sourceMap) => load.call(context, source, sourceMap));
}
