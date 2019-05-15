import path from 'path';
import webpack from 'webpack';
import compiler from './compiler';

const jsonLoaderRules: webpack.RuleSetRule[] = [
    {
        type: 'json',
        test: /[/.]dl-dataset.json$/,
        use: [
            path.resolve(__dirname, '../src/loaders/dl-dataset-loader.ts'),
            path.resolve(__dirname, '../src/loaders/json-dependencies-loader.ts'),
            path.resolve(__dirname, '../src/loaders/json-json5-loader.ts'),
        ],
    },
    {
        type: 'json',
        test: /\.collection\.json$/,
        use: [
            path.resolve(__dirname, '../src/loaders/json-wrap-loader.ts?insertionPoint=/@id'),
            path.resolve(__dirname, '../src/loaders/json-raw-loader.ts'),
            'extract-loader',
            {
                loader: 'file-loader',
                options: {
                    name: 'bundled/[path][name].[ext]',
                },
            },
            path.resolve(__dirname, '../src/loaders/json-json5-loader.ts'),
        ],
    },
];

test('collection references are resolved', async () => {
    const stats = await compiler('./data/minimal/dl-dataset.json', jsonLoaderRules);
    const output = stats.toJson().modules[0].source;

    expect(JSON.parse(output)).toEqual({
        name: 'John Rylands',
        collections: [
            {'@id': 'bundled/data/minimal/collections/hebrew.collection.json'},
        ],
    });
});
