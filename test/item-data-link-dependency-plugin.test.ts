import * as path from 'path';
import webpack from 'webpack';
import {ItemDataLinkDependencyPlugin} from '../src/loaders/item-data-link-dependency-plugin';
import {CDLRole} from '../src/uris';
import compiler from './compiler';
import {getModuleSource, readPathAsString} from './util';

test('item data links are handled specially by ItemDataLinkDependencyPlugin', async () => {
    // Here we load the data.json dependency linked from item.json in two ways based on @role values.

    const dir = './data/item-data-link-dependency-plugin';
    const item = `${dir}/item.json`;
    const rules: webpack.RuleSetRule[] = [
        {
            test: path.resolve(__dirname, item),
            use: [
                {loader: '../src/loaders/json-dependencies-loader.ts',
                 options: {plugins: [new ItemDataLinkDependencyPlugin({roles: [CDLRole.curie.uri('foo')],
                                                                        requestQuery: 'a'})]}},
                {loader: '../src/loaders/json-dependencies-loader.ts',
                 options: {plugins: [new ItemDataLinkDependencyPlugin({roles: [CDLRole.curie.uri('baz'),
                                                                               CDLRole.curie.uri('bar')],
                                                                       requestQuery: 'b'})]}},
            ],
        },
        {test: /\/data\.json$/, resourceQuery: '?a',
         use: '../src/loaders/json-wrap-loader.ts?{"insertionPoint": "/data", "template": {"handledBy": "a"}}'},
        {test: /\/data\.json$/, resourceQuery: '?b',
            use: '../src/loaders/json-wrap-loader.ts?{"insertionPoint": "/data", "template": {"handledBy": "b"}}'},
    ];

    const stats = await compiler(item, rules);
    expect(JSON.parse(getModuleSource(item, stats))).toEqual(JSON.parse(await readPathAsString(item)));
    expect(JSON.parse(getModuleSource(`${dir}/data.json?a`, stats))).toEqual({handledBy: 'a', data: {data: 42}});
    expect(JSON.parse(getModuleSource(`${dir}/data.json?b`, stats))).toEqual({handledBy: 'b', data: {data: 42}});
});
