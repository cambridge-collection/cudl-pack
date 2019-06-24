import path from 'path';
import webpack from 'webpack';
import {createAsyncLoader} from '../utils';
import {apply} from '../xslt-transformations';

async function load(this: webpack.loader.LoaderContext, source: string): Promise<string> {

    const xsltPrePath: string = path.resolve(__dirname, '../xslt/msTeiPreFilter.xsl').toString();
    const xsltDocPath: string = path.resolve(__dirname, '../xslt/jsonDocFormatter.xsl').toString();

    const prePromise = await apply(this.context, this.resourcePath, source, xsltPrePath).then(async (result) => {
        return await apply(this.context, this.resourcePath, result, xsltDocPath);
    }, (err) => {
        throw err;
    }).then((result) => {
        return result;
    }, (err) => {
        throw err;
    });

    return prePromise;
}

export default createAsyncLoader(load);
