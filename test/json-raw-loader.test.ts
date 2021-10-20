import path from 'path';
import webpack from 'webpack';
import compiler from './compiler';
import {getModule, getModuleSource} from './util';

test('loader integration', async () => {
    const rules: webpack.RuleSetRule[] = [{
        type: 'json',
        test: /\.txt$/,
        use: path.resolve(__dirname, '../src/loaders/json-raw-loader.ts'),
    }];

    const stats = await compiler('./data/text.txt', rules);

    expect(getModule('./data/text.txt', stats).moduleType).toEqual('json');
    expect(JSON.parse(getModuleSource('./data/text.txt', stats))).toEqual('Text\nfile.\n');
});
