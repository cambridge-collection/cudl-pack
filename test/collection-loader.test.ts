import fp from 'lodash/fp';
import path from 'path';
import webpack from 'webpack';
import compiler from './compiler';

const extractToFileLoaders: webpack.RuleSetUseItem[] = [
    path.resolve(__dirname, '../src/loaders/json-wrap-loader.ts?insertionPoint=/@id'),
    path.resolve(__dirname, '../src/loaders/json-raw-loader.ts'),
    'extract-loader',
    {
        loader: 'file-loader',
        options: {
            name: 'bundled/[path][name].[ext]',
        },
    },
];

const jsonLoaderRules: webpack.RuleSetRule[] = [
    {
        type: 'json',
        test: /[/.]collection.json$/,
        use: (info) => {
            const collectionLoaders = [
                path.resolve(__dirname, '../src/loaders/collection-loader.ts'),
                path.resolve(__dirname, '../src/loaders/json-dependencies-loader.ts'),
                path.resolve(__dirname, '../src/loaders/json-json5-loader.ts'),
            ];
            // If a collection is loaded from another collection then turn it into a reference to an extracted file,
            // otherwise we would nest the collections where they're referenced (which the schema doesn't allow).
            if(info.issuer.endsWith('.collection.json')) {
                return extractToFileLoaders.concat(collectionLoaders);
            }
            return collectionLoaders;
        },
    },
    {
        type: 'json',
        test: /\.json$/,
        exclude: /\.(collection)\.json$/,
        use: extractToFileLoaders.concat([
            path.resolve(__dirname, '../src/loaders/json-json5-loader.ts'),
        ]),
    },
    {
        type: 'json',
        test: /\.html$/,
        use: extractToFileLoaders.concat(['extract-loader', 'html-loader']),
    },
];

test('collection references are resolved', async () => {
    const stats = await compiler('./data/collections/kitchen-sink.collection.json', jsonLoaderRules);
    const modules = stats.toJson().modules;

    const kitchenSinkModule = modules[0];
    expect(kitchenSinkModule.name).toEqual('./data/collections/kitchen-sink.collection.json');
    const kitchenSink = JSON.parse(kitchenSinkModule.source);

    // This is the loaded module
    expect(kitchenSink['@type'])
        .toEqual('https://schemas.cudl.lib.cam.ac.uk/package/v1/collection.json');

    // References are replaced with paths to packaged content.
    expect(kitchenSink.items[0])
        .toEqual({'@id': 'bundled/data/collections/referenced-modules/mock.item.json'});

    expect(fp.pipe(
        fp.drop(1),
        fp.map((mod: {name: string, source: string}) => ({name: mod.name, source: mod.source})),
        fp.sortBy(['name']),
    )(modules)).toEqual([
        {name: './data/collections/referenced-modules/from-nested-collection.item.json',
         source: '{"@id":"bundled/data/collections/referenced-modules/from-nested-collection.item.json"}'},
        {name: './data/collections/referenced-modules/funder-organisation.json',
         source: '{"@id":"bundled/data/collections/referenced-modules/funder-organisation.json"}'},
        {name: './data/collections/referenced-modules/funder-person.json',
         source: '{"@id":"bundled/data/collections/referenced-modules/funder-person.json"}'},
        {name: './data/collections/referenced-modules/hebrew-description.html',
         source: '{"@id":"bundled/data/collections/referenced-modules/hebrew-description.html"}'},
        {name: './data/collections/referenced-modules/hebrew-funders.html',
         source: '{"@id":"bundled/data/collections/referenced-modules/hebrew-funders.html"}'},
        {name: './data/collections/referenced-modules/mock.item.json',
         source: '{"@id":"bundled/data/collections/referenced-modules/mock.item.json"}'},
        {name: './data/collections/referenced-modules/nested.collection.json',
         source: '{"@id":"bundled/data/collections/referenced-modules/nested.collection.json"}'},
    ]);
});
