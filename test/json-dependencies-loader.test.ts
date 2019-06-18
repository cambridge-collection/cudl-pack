import path from 'path';
import webpack from 'webpack';
import {JSONDependenciesLoaderOptions, ReferenceSelector} from '../src/loaders/json-dependencies-loader';
import compiler from './compiler';
import {readPathAsString} from './util';

test('references are replaced by resolved JSON objects', async () => {
    const rules = [{
        test: /\.json$/,
        use: [{
                loader: '../src/loaders/json-dependencies-loader.ts',
        }],
    }];

    const stats = await compiler('./data/references/a', rules);
    const module = stats.toJson().modules[0];

    expect(stats.compilation.modules[0].type).toEqual('json');

    expect(JSON.parse(module.source)).toEqual({
            thisIs: 'a',
            b: {
                thisIs: 'b',
                c: {
                    thisIs: 'c',
                },
            },
        },
    );
});

test('reference pattern can be specified via options', async () => {
    const rules = [{
        test: /\.json$/,
        use: [{
            loader: '../src/loaders/json-dependencies-loader.ts',
            options: {
                references: {
                    expression: '$..["href"]',
                    substitutionLevel: 1,
                },
            } as JSONDependenciesLoaderOptions,
        }],
    }];

    const stats = await compiler('./data/references/alternate-syntax', rules);
    const module = stats.toJson().modules[0];

    expect(stats.compilation.modules[0].type).toEqual('json');

    expect(JSON.parse(module.source)).toEqual({
        c: {
            thisIs: 'c',
        },
    });
});

test('a user-provided function can enumerate references', async () => {
    const expectedJSONDoc = JSON.parse(await readPathAsString('data/references/alternate-syntax.json'));
    const refSelector: ReferenceSelector = ({context, json}) => {
        if(context.resourcePath.endsWith('/alternate-syntax.json')) {
            expect(json).toEqual(expectedJSONDoc);
            return [
                {reference: 'c.json', substitutionPoint: ['c']},
            ];
        }
        else {
            expect(context.resourcePath.endsWith('/c.json')).toBeTruthy();
            return [];
        }
    };

    const rules = [{
        test: /\.json$/,
        use: [{
            loader: '../src/loaders/json-dependencies-loader.ts',
            options: {
                references: refSelector,
            } as JSONDependenciesLoaderOptions,
        }],
    }];

    const stats = await compiler('./data/references/alternate-syntax', rules);
    const module = stats.toJson().modules[0];

    expect(stats.compilation.modules[0].type).toEqual('json');

    expect(JSON.parse(module.source)).toEqual({
        c: {
            thisIs: 'c',
        },
    });
    expect.assertions(4);
});

test('references in arrays are replaced by resolved JSON objects', async () => {
    const rules = [{
        test: /\.json$/,
        use: ['../src/loaders/json-dependencies-loader.ts'],
    }];

    const stats = await compiler('./data/references/ref-list', rules);
    const module = stats.toJson().modules[0];

    expect(stats.compilation.modules[0].type).toEqual('json');

    expect(JSON.parse(module.source)).toEqual({
            references: [
                {this:  'is not a ref'},
                {
                    thisIs: 'a',
                    b: {
                        thisIs: 'b',
                        c: {
                            thisIs: 'c',
                        },
                    },
                },
                {
                    thisIs: 'b',
                    c: {
                        thisIs: 'c',
                    },
                },
                {this:  'is also not a ref'},
            ],
        },
    );
});

test('references are replaced by resolved JSON strings', async () => {
    const rules: webpack.RuleSetRule[] = [
        {
            test: /\.json$/,
            use: [{
                loader: '../src/loaders/json-dependencies-loader.ts',
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
        nonJsonThing: 'Plain text.\n',
    });
});

test('references to missing modules are reported', async () => {
    const rules: webpack.RuleSetRule[] = [{
        test: /\.json$/,
        use: [{
            loader: '../src/loaders/json-dependencies-loader.ts',
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
                loader: '../src/loaders/json-dependencies-loader.ts',
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
