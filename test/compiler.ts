import MemoryFileSystem from 'memory-fs';
import path from 'path';
import webpack from 'webpack';

function run(options: webpack.Configuration): Promise<webpack.Stats>;
function run(fixture: string, rules: webpack.RuleSetRule[]): Promise<webpack.Stats>;
function run(options: string | webpack.Configuration, rules?: webpack.RuleSetRule[]): Promise<webpack.Stats> {
    let configuration: webpack.Configuration;
    if(typeof options === 'string') {
        configuration = {
            entry: `./${options}`,
            module: {rules: rules || []},
        };
    }
    else
        configuration = options;

    const compiler = webpack({
        context: __dirname,
        output: {
            path: path.resolve(__dirname),
            filename: 'bundle.js',
        },
        resolve: {
            extensions: [
                // type extensions for our file types
                '.dl-dataset.json',
                '.collection.json',
                '.item.json',
                // default extensions
                '.wasm', '.mjs', '.js', '.json',
            ],
        },
        ...configuration,
    });

    compiler.outputFileSystem = new MemoryFileSystem();

    return new Promise((resolve, reject) => {
        compiler.run((err, stats) => {
            if(err || stats.hasErrors()) {
                reject(err || stats.toJson().errors.join('\n\n'));
            }

            resolve(stats);
        });
    });
}

export default run;
