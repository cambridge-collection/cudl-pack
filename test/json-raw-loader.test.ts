import path from 'path';
import webpack from 'webpack';
import compiler from './compiler';

test('loader integration', async () => {
    const rules: webpack.RuleSetRule[] = [{
        type: 'json',
        test: /\.txt$/,
        use: path.resolve(__dirname, '../src/loaders/json-raw-loader.ts'),
    }];

    const stats = await compiler('./data/text.txt', rules);
    const module = stats.toJson().modules[0];

    expect(stats.compilation.modules[0].type).toEqual('json');
    expect(JSON.parse(module.source)).toEqual('Text\nfile.\n');
});
