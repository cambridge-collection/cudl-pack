import fs from 'fs';
import path from 'path';
import webpack from 'webpack';
import compiler from './compiler';

test('Load full TEI Item to Internal JSON', async () => {

    jest.setTimeout(30000);

    const rules: webpack.RuleSetRule[] = [{
        type: 'json',
        test: /\.xml$/,
        use: path.resolve(__dirname, '../src/loaders/tei-loader.ts'),
    }];

    const stats = await compiler('./data/tei/tei-full-item.xml', rules);
    const module = stats.toJson().modules[0];

    expect(stats.compilation.modules[0].type).toEqual('json');
    fs.readFile(path.resolve(__dirname, './data/tei/tei-json-output.json'), (err, data) => {
        if (err) {
            throw err;
        }

        expect(module.source.trim()).toEqual(data.toString().trim());
    });
});
