import path from 'path';
import webpack from 'webpack';
import compiler from './compiler';

test('references are replaced by resolved JSON objects', async () => {
    const rules = [{
        test: /\.json$/,
        use: [{
                loader: path.resolve(__dirname, '../src/loaders/json-dependencies-loader.ts'),
                options: {references: '$..ref'},
        }],
    }];

    const stats = await compiler('./data/references/a', rules);
    const module = stats.toJson().modules[0];

    expect(stats.compilation.modules[0].type).toEqual('json');

    expect(JSON.parse(module.source)).toEqual({
            thisIs: 'a',
            ref: {
                thisIs: 'b',
                ref: {
                    thisIs: 'c',
                },
            },
        },
    );
});

test('references are replaced by resolved JSON strings', async () => {
    const rules: webpack.RuleSetRule[] = [
        {
            test: /\.json$/,
            use: [{
                    loader: path.resolve(__dirname, '../src/loaders/json-dependencies-loader.ts'),
                    options: {references: '$..ref'},
            }],
        },
        {
            type: 'json',
            test: /\.txt$/,
            use: path.resolve(__dirname, '../src/loaders/json-raw-loader.ts'),
        },
    ];

    const stats = await compiler('./data/references/json-pointing-to-non-json', rules);
    const module = stats.toJson().modules[0];

    expect(stats.compilation.modules[0].type).toEqual('json');

    expect(JSON.parse(module.source)).toEqual({
        ref: 'Plain text.\n',
    });
});

test('references to missing modules are reported', async () => {
    const rules: webpack.RuleSetRule[] = [{
        test: /\.json$/,
        use: [{
                loader: path.resolve(__dirname, '../src/loaders/json-dependencies-loader.ts'),
                options: {references: '$..ref'},
        }],
    }];

    await expect(compiler('./data/references/missing', rules)).rejects
        .toMatch(/Unable to load module referenced by: '.\/does-not-exist': ModuleNotFoundError: /);
});

test('referenced modules not containing JSON are reported', async () => {
    const rules: webpack.RuleSetRule[] = [
        {
            test: /\.json$/,
            use: [{
                loader: path.resolve(__dirname, '../src/loaders/json-dependencies-loader.ts'),
                options: {references: '$..ref'},
            }],
        },
        {
            type: 'javascript/auto',
            test: /\.txt$/,
            use: 'raw-loader',
        },
    ];

    await expect(compiler('./data/references/json-pointing-to-non-json', rules)).rejects
        .toMatch(new RegExp(
            'Unable to parse referenced module as JSON. module type: javascript/auto, reference: \'./file.txt\', ' +
            'parse error: SyntaxError: '));
});
