import fp from 'lodash/fp';
import {RawSourceMap} from 'source-map';
import webpack from 'webpack';

export function bindPromiseToCallback<T>(
    promise: Promise<T>, callback: (err: any, value?: T) => void): void {

    promise.then(
        (value) => { callback(null, value); }, callback);
}

type Source = string | Buffer;
export type AsyncLoadFunction =
    (this: webpack.loader.LoaderContext, source: Source, sourceMap?: RawSourceMap)
        => Promise<Source>;
export type AsyncLoadMethod<T> =
    (this: T, context: webpack.loader.LoaderContext, source: Source, sourceMap?: RawSourceMap)
        => Promise<Source>;

/**
 * Create a normal webpack loader function from a promise-returning async function which takes an explicit context
 * argument.
 *
 * The difference with [[createAsyncLoader]] is that this doesn't require the use of the `this` arg, so class methods
 * can use it directly.
 */
export function createAsyncLoaderFromMethod<T>(
        load: AsyncLoadMethod<T>, thisArg: T): webpack.loader.Loader {
    return function(this: webpack.loader.LoaderContext, source: Source, sourceMap?: RawSourceMap): void {
        const callback = this.async();
        if(callback === undefined) {
            throw new Error('loader context returned no callback from async()');
        }

        bindPromiseToCallback(load.call(thisArg, this, source, sourceMap), callback);
    };
}

/**
 * Create a normal webpack loader function from a promise-returning async
 * loader function.
 */
export function createAsyncLoader(load: AsyncLoadFunction):
        webpack.loader.Loader {
    return createAsyncLoaderFromMethod(
        (context, source, sourceMap) => load.call(context, source, sourceMap), undefined);
}

/**
 * Convert a sort key function, producing fixed-size tuples into an array of functions, each of which producing the ith
 * value from the key function's result tuple.
 *
 * Can be used to convert a tuple-producing key function to a list of scalar-producing key functions required by
 * lodash.sortBy (because Javascript compares arrays by converting them to strings).
 *
 * @param keyFunc A tuple-producing sort key function
 * @param keyLength The number of elements produced by keyFunc
 */
export function sortKeyTupleFuncToScalarFuncs<T, K>(keyFunc: (obj: T) => K[], keyLength: number): Array<(obj: T) => K> {
    return fp.map(i => (obj: T) => (keyFunc(obj)[i]),
        fp.range(0, keyLength));
}

/** A type guard to exclude undefined. */
export function isNotUndefined<T>(x: T | undefined): x is T {
    return x !== undefined;
}

export function enumMembers<T>(_enum: T): Set<keyof T> {
    const props = _enum as {[key: string]: any};
    return new Set(Object.keys(props)
        .filter(k => typeof props[k] === 'number') as Array<keyof T>);
}

export function enumMemberGuard<T>(_enum: T): (value: any) => value is keyof T {
    const members = enumMembers(_enum) as ReadonlySet<any>;
    function guard(value: any): value is keyof T {
        return members.has(value);
    }
    return guard;
}
