import {parseDlDatasetXml} from '../dl-dataset';
import {createAsyncLoader} from '../utils';

export default createAsyncLoader(async (source) => {
    return await parseDlDatasetXml(source)
        .then(JSON.stringify);
});
