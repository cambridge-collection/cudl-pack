import json5 from 'json5';
import path from 'path';
import webpack from 'webpack';
import {ItemToInternalItemConverter} from '../src/convert/item/to/internal-item';
import {InternalItemfromPackageItemLoaderOptions} from '../src/loaders/internal-item-from-package-item-loader';
import compiler from './compiler';
import {readPathAsString} from './util';

test('loader transforms package items to internal items', async () => {
    const rules: webpack.RuleSetRule[] = [
        {
            type: 'json',
            test: /\.json5?$/,
            use: [
                path.resolve(__dirname, '../src/loaders/internal-item-from-package-item-loader.ts'),
                path.resolve(__dirname, '../src/loaders/json-json5-loader.ts'),
            ],
        },
    ];

    const stats = await compiler('./convert/item/to/internal-item/data/package-item.json5', rules);
    const output = stats.toJson().modules[0].source;

    const expected = json5.parse(await readPathAsString(
        './convert/item/to/internal-item/data/internal-item_default-plugins.json5'));

    expect(JSON.parse(output)).toEqual(expected);
});

test('loader uses converter option', async () => {
    const converterNoPlugins = new ItemToInternalItemConverter();

    const rules: webpack.RuleSetRule[] = [
        {
            type: 'json',
            test: /\.json5?$/,
            use: [
                {
                    loader: path.resolve(__dirname, '../src/loaders/internal-item-from-package-item-loader.ts'),
                    options: {
                        converter: converterNoPlugins,
                    } as InternalItemfromPackageItemLoaderOptions,
                },
                path.resolve(__dirname, '../src/loaders/json-json5-loader.ts'),
            ],
        },
    ];

    const stats = await compiler('./convert/item/to/internal-item/data/package-item.json5', rules);
    const output = stats.toJson().modules[0].source;

    const expected = json5.parse(await readPathAsString(
        './convert/item/to/internal-item/data/internal-item_no-plugins.json5'));

    expect(JSON.parse(output)).toEqual(expected);
});
