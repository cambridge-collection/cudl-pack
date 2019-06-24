import {DocumentFile, XsltTransformer} from 'cudl-node-xslt-java-bridge';
import {promisify} from 'util';

export async function apply(context: any, resourcePath: any, data: string, stylesheetPath: string): Promise<string> {

    const transformer = new XsltTransformer(stylesheetPath);
    const transform = promisify<DocumentFile, DocumentFile[]>(transformer.transform.bind(transformer));

    const document: DocumentFile = {
        base: context,
        path: resourcePath,
        contents: data,
    };
    const results: DocumentFile[] = await transform(document);

    if(results.length !== 1) {
        throw new Error(`Expected 1 result from XSLT transform but got ${results.length}`);
    }
    const [{contents}] = results;

    return contents;
}
