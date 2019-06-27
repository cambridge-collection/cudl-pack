import path from 'path';
import webpack from 'webpack';
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

test.each<[number | string | undefined, string]>([
    [undefined, noIndent],
    [0, noIndent],
    ['', noIndent],
    [2, indent2],
    ['  ', indent2],
    ['\t ', indentTabSpace],
])('loader formats JSON with %j', async (indent, expectedJson) => {
    const options = indent === undefined ? {} : {indent};

    const rules: webpack.RuleSetRule[] = [{
        type: 'json',
        test: /\.json$/,
        use: {
            loader: path.resolve(__dirname, '../src/loaders/json-format-loader.ts'),
            options,
        },
    }];

    const stats = await compiler('./data/references/c.json', rules);
    const module = stats.toJson().modules[0];
    expect(module.source).toBe(expectedJson);
});
