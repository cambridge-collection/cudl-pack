import MemoryFileSystem from 'memory-fs';
import path from 'path';
import webpack from 'webpack';

function run(options: webpack.Configuration): Promise<webpack.Stats>;
function run(fixture: string, rules: webpack.RuleSetRule[]): Promise<webpack.Stats>;
function run(options: string | webpack.Configuration, rules?: webpack.RuleSetRule[]): Promise<webpack.Stats> {
    let configuration: webpack.Configuration;
    if(typeof options === 'string') {
        configuration = {
            entry: `${options}`,
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
            publicPath: '',
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
        stats: {
            logging: 'verbose',
        },
        ...configuration,
    });

    compiler.outputFileSystem = new MemoryFileSystem();

    return new Promise((resolve, reject) => {
        compiler.run((err, stats) => {
            if(err) {
                reject(err);
            }
            if(stats === undefined) {
                reject(new Error('Webpack compiler run() produced no stats'));
                return;
            }
            if(stats.hasErrors()) {
                const statsJson = stats.toJson();
                const errorMessages = statsJson.errors?.map(e => {
                    if(e.moduleName && e.moduleIdentifier) {
                        // jest cleverly strips out tracebacks from error messages, so prepend a > to each line to stop
                        // it being quite so "clever".
                        const message = e.stack ? e.stack.split('\n').map(line => `> ${line}`).join('\n') : e.message;
                        return `Failed to build module ${e.moduleName} ('${e.moduleIdentifier}'):\n${message}`;
                    }
                    else {
                        return `${e.message}\n${e.stack}`;
                    }
                }).join('\n---\n');
                reject(new Error(`Webpack build failed with ${statsJson.errorsCount} errors:\n${errorMessages}`));
            }

            resolve(stats);
        });
    });
}

export default run;
