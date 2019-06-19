import webpack from 'webpack';
import compiler from './compiler';

test('xslt-loader', async () => {
    const rules: webpack.RuleSetRule[] = [{
        type: 'json',
        test: /\.xml$/,
        use: [
            '../src/loaders/json-raw-loader.ts',
            '../src/loaders/xslt-loader.ts?stylesheet=./data/xslt/a.xslt',
        ],
    }];

    const stats = await compiler('./data/example.dl-dataset.xml', rules);
    const module = stats.toJson().modules[0];

    expect(stats.compilation.modules[0].type).toEqual('json');
    expect(JSON.parse(module.source)).toEqual('<?xml version="1.0" encoding="UTF-8"?><foobar>Hi</foobar>');
});
