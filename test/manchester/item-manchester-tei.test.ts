import 'jest-xml-matcher';
import * as path from 'path';
import {ensureDefined, readPathAsString} from '../util';
import {runXsltLoader} from '../xslt-loader.test';

test('item-manchester-tei.xsl converts TEI to package item XML representation', async () => {
    const stats = await runXsltLoader({
        stylesheetPath: path.resolve(__dirname, '../../src/loaders/manchester/item-manchester-tei.xsl'),
        inputPath: './manchester/data/MS-HEBREW-GASTER-00086.xml',
    });
    const module = ensureDefined.wrap(stats.toJson()).modules[0];
    expect(JSON.parse(module.source))
        .toEqualXML(await readPathAsString('manchester/data/MS-HEBREW-GASTER-00086.item.xml'));
});
