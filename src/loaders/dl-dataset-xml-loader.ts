import webpack from 'webpack';
import {parseDlDatasetXml} from '../dl-dataset';
import {createAsyncLoader} from '../utils';

async function load(this: webpack.loader.LoaderContext, source: string | Buffer): Promise<string> {
    return await parseDlDatasetXml(source)
        .then(JSON.stringify);
}

export default createAsyncLoader(load);
