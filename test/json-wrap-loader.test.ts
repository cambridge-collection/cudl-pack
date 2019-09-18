import path from 'path';
import webpack from 'webpack';
import compiler from './compiler';

import loader from '../src/loaders/json-wrap-loader';
import {ensureDefined} from './util';

test.each([
    ['?insertionPoint=/foo', 123, {foo: 123}],
    ['?insertionPoint=/foo/bar', 123, {foo: {bar: 123}}],
    ['?{insertionPoint: "/foo", template: {abc: 456}}', 123, {foo: 123, abc: 456}],
    // jsonpointer / is the empty string at root
    ['?insertionPoint=/', 123, {'': 123}],
])('loader with options query %s wraps %j as %j', (query: string, source: any, expected: any) => {
    const jsonResult = loader.call({query}, JSON.stringify(source));
    expect(JSON.parse(jsonResult)).toEqual(expected);
});

test.each([
    [{insertionPoint: '/text'}, {text: 'Text\nfile.\n'}],
    [{insertionPoint: '/text', template: {abc: 456}}, {abc: 456, text: 'Text\nfile.\n'}],
])('webpack applies loader with options %j resulting in %j', async (options, expected) => {
    const rules: webpack.RuleSetRule[] = [{
        type: 'json',
        test: /\.txt$/,
        use: [
            {
                loader: path.resolve(__dirname, '../src/loaders/json-wrap-loader.ts'),
                options,
            },
            path.resolve(__dirname, '../src/loaders/json-raw-loader.ts'),
        ],
    }];

    const stats = await compiler('./data/text.txt', rules);
    const module = ensureDefined.wrap(stats.toJson()).modules[0];

    expect(stats.compilation.modules[0].type).toEqual('json');
    expect(JSON.parse(module.source)).toEqual(expected);
});
