import MemoryFileSystem from 'memory-fs';
import path from 'path';
import webpack from 'webpack';

export default (fixture: string, rules: webpack.RuleSetRule[]): Promise<webpack.Stats> => {
    const compiler = webpack({
        context: __dirname,
        entry: `./${fixture}`,
        output: {
            path: path.resolve(__dirname),
            filename: 'bundle.js',
        },
        module: {
            rules,
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
