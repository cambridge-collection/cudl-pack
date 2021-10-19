import fp from 'lodash/fp';
import path from 'path';
import webpack from 'webpack';
import compiler from './compiler';
import { getModuleSource } from './util';

const extractToFileLoaders: webpack.RuleSetUseItem[] = [
    {
        loader: path.resolve(__dirname, '../src/loaders/json-wrap-loader.ts'),
        options: {
            insertionPoint: '/@id',
        },
    },
    path.resolve(__dirname, '../src/loaders/json-raw-loader.ts'),
    'extract-loader',
    {
        loader: 'file-loader',
        options: {
            name: 'bundled/[path][name].[ext]',
        },
    },
];

const collectionLoaders = [
    path.resolve(__dirname, '../src/loaders/collection-loader.ts'),
    path.resolve(__dirname, '../src/loaders/json-dependencies-loader.ts'),
    path.resolve(__dirname, '../src/loaders/json-json5-loader.ts'),
];

const jsonLoaderRules: webpack.RuleSetRule[] = [
    // If a collection is loaded from another collection then turn it into a reference to an extracted file,
    // otherwise we would nest the collections where they're referenced (which the schema doesn't allow).
    {
        type: 'json',
        test: /[/.]collection\.json$/,
        issuer: /\.collection\.json$/,
        use: extractToFileLoaders.concat(collectionLoaders),
    },
    {
        type: 'json',
        test: /[/.]collection\.json$/,
        issuer: {not: /\.collection\.json$/},
        use: collectionLoaders,
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
    const modules = Array.from(stats.toJson({source: true}).modules || []);

    const kitchenSink = JSON.parse(getModuleSource('./data/collections/kitchen-sink.collection.json', stats));

    // This is the loaded module
    expect(kitchenSink['@type'])
        .toEqual('https://schemas.cudl.lib.cam.ac.uk/package/v1/collection.json');

    // References are replaced with paths to packaged content.
    expect(kitchenSink.items[0])
        .toEqual({'@id': 'bundled/data/collections/referenced-modules/mock.item.json'});

    expect(fp.pipe(
        fp.map((mod: webpack.StatsModule) => ({name: mod.name, source: mod.source})),
        fp.sortBy(['name']),
    )(modules.slice(1))).toEqual([
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
