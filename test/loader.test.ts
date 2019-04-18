// tslint:disable no-eval
import path from 'path';
import webpack from 'webpack';
import compiler from './compiler';

const xmlLoaderRules: webpack.RuleSetRule[] = [{
    type: 'json',
    test: /\.xml$/,
    use: [
        { loader: path.resolve(__dirname, '../src/loaders/site-xml-loader.ts') },
    ],
}];

test('site-xml-loader', async () => {
    const stats = await compiler('./data/site.xml', xmlLoaderRules);
    const output = stats.toJson().modules[0].source;

    expect(JSON.parse(output)).toEqual({
        name: 'John Rylands',
        collections: [
            {href: 'collections/hebrew'},
            {href: 'collections/petrarch'},
            {href: 'collections/landscapehistories'},
            {href: 'collections/treasures'},
            {href: 'collections/sassoon'},
            {href: 'collections/lewisgibson'},
            {href: 'collections/darwinhooker'},
            {href: 'collections/japanese'},
            {href: 'collections/tennyson'},
        ],
    });
});

const jsonLoaderRules: webpack.RuleSetRule[] = [
    {
        type: 'json',
        test: /\.json$/,
        exclude: /collections\/.*\.json$/,
        use: [
            {
                loader: path.resolve(__dirname, '../src/loaders/json-dependencies-loader.ts'),
                options: {
                    references: '$.collections[*].href',
                },
            },
        ],
    },
    {
        type: 'json',
        test: /collections\/.*\.json$/,
        use: [
            path.resolve(__dirname, '../src/loaders/json-raw-loader.ts'),
            'extract-loader',
            {
                loader: 'file-loader',
                options: {
                    name: 'bundled/[path][name].[ext]',
                },
            },
        ],
    },
];

test('site-loader', async () => {
    const stats = await compiler('./data/minimal/site.json', jsonLoaderRules);
    const output = stats.toJson().modules[0].source;

    expect(JSON.parse(output)).toEqual({
        name: 'John Rylands',
        collections: [
            {href: 'bundled/data/minimal/collections/hebrew.json'},
        ],
    });
});
