import path from 'path';
import webpack from 'webpack';
import {Options} from '../src/loaders/json-format-loader';
import compiler from './compiler';
import {getModuleSource} from './util';

const noIndent = '{"thisIs":"c"}';
const indent2 = `\
{
  "thisIs": "c"
}\n`;
const indentTabSpace = `\
{
\t "thisIs": "c"
}\n`;

test.each<[Options | undefined, string]>([
    [undefined, noIndent],
    [{indent: 0}, noIndent],
    [{finalNewline: true}, noIndent + '\n'],
    [{indent: ''}, noIndent],
    [{indent: 2}, indent2],
    [{indent: 2, finalNewline: false}, indent2.trimRight()],
    [{indent: '  '}, indent2],
    [{indent: '\t '}, indentTabSpace],
])('loader formats JSON with options %j', async (options, expectedJson) => {
    const rules: webpack.RuleSetRule[] = [{
        type: 'json',
        test: /\.json$/,
        use: {
            loader: path.resolve(__dirname, '../src/loaders/json-format-loader.ts'),
            options,
        },
    }];

    const stats = await compiler('./data/references/c.json', rules);
    expect(getModuleSource('./data/references/c.json', stats)).toEqual(expectedJson);
});
