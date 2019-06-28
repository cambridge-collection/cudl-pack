import webpack from 'webpack';
import {NamespaceLoader} from '../src/item';
import {createAsyncLoader} from '../src/utils';

export default createAsyncLoader(
async function(this: webpack.loader.LoaderContext): Promise<string> {
    const ns = await NamespaceLoader.forWebpackLoader(this).loadNamespace('./namespace.json');

    expect(ns.getExpandedUri('foo:bar')).toBe('http://example.com/bar');
    expect(ns.getCompactedUri('http://example.com/bar')).toBe('foo:bar');

    return JSON.stringify({});
});
