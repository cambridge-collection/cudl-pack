import path from 'path';
import webpack from 'webpack';
import {Options} from '../src/loaders/json-format-loader';
import compiler from './compiler';

const noIndent = '{"thisIs":"c"}';
const indent2 = `\
{
  "thisIs": "c"
}\n`;
const indentTabSpace = `\
{
\t "thisIs": "c"
}\n`;

test.each<[string, Options | undefined, string]>([
    ['', undefined, noIndent],
    ['', {indent: 0}, noIndent],
    ['', {finalNewline: true}, noIndent + '\n'],
    ['', {indent: ''}, noIndent],
    ['', {indent: 2}, indent2],
    ['', {indent: 2, finalNewline: false}, indent2.trimRight()],
    ['', {indent: '  '}, indent2],
    ['', {indent: '\t '}, indentTabSpace],
    ['?', undefined, noIndent],
    ['?finalNewline=true', undefined, noIndent + '\n'],
    ['?indent=', undefined, noIndent],
    ['?indent=0', undefined, noIndent],
    ['?indent=2', undefined, indent2],
    ['?indent=2&finalNewline=false', undefined, indent2.trimRight()],
    ['?indent=%20%20', undefined, indent2],
    ['?indent=%09%20', undefined, indentTabSpace],
])('loader formats JSON with query %j and options %j', async (query, options, expectedJson) => {
    const rules: webpack.RuleSetRule[] = [{
        type: 'json',
        test: /\.json$/,
        use: {
            loader: path.resolve(__dirname, '../src/loaders/json-format-loader.ts') + query,
            options,
        },
    }];

    const stats = await compiler('./data/references/c.json', rules);
    const module = stats.toJson().modules[0];
    expect(module.source).toBe(expectedJson);
});
