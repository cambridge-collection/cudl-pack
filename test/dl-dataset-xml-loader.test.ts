import path from 'path';
import webpack from 'webpack';
import compiler from './compiler';

const xmlLoaderRules: webpack.RuleSetRule[] = [{
    type: 'json',
    test: /[./]dl-dataset\.xml$/,
    use: [
        { loader: path.resolve(__dirname, '../src/loaders/dl-dataset-xml-loader.ts') },
    ],
}];

test('dl-dataset-xml-loader', async () => {
    const stats = await compiler('./data/example.dl-dataset.xml', xmlLoaderRules);
    const output = stats.toJson().modules[0].source;

    expect(JSON.parse(output)).toEqual({
        name: 'John Rylands',
        collections: [
            {'@id': 'collections/hebrew'},
            {'@id': 'collections/petrarch'},
            {'@id': 'collections/landscapehistories'},
            {'@id': 'collections/treasures'},
            {'@id': 'collections/sassoon'},
            {'@id': 'collections/lewisgibson'},
            {'@id': 'collections/darwinhooker'},
            {'@id': 'collections/japanese'},
            {'@id': 'collections/tennyson'},
        ],
    });
});

test('dl-dataset-xml-loader rejects invalid input', async () => {
    await expect(compiler('./data/invalid_bad_collection.dl-dataset.xml', xmlLoaderRules))
        .rejects.toMatch(/Parsed dl-dataset XML is invalid:/);
});
