import MemoryFileSystem from 'memory-fs';
import path from 'path';
import webpack from 'webpack';

export default (fixture: string, options = {}): Promise<webpack.Stats> => {
    const compiler = webpack({
        context: __dirname,
        entry: `./${fixture}`,
        output: {
            path: path.resolve(__dirname),
            filename: 'bundle.js',
        },
        module: {
            rules: [{
                test: /\.xml$/,
                use: [
                    { loader: 'json-loader' },
                    { loader: path.resolve(__dirname, '../src/loaders/site-xml-loader.ts') },
                    // { loader: 'xml-loader' },
                ],
            }],
        },
    });

    compiler.outputFileSystem = new MemoryFileSystem();

    return new Promise((resolve, reject) => {
        compiler.run((err, stats) => {
            if(err || stats.hasErrors()) {
                reject(err || stats.toJson().errors);
            }

            resolve(stats);
        });
    });
};
