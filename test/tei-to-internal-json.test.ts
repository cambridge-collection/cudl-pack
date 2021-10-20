import 'jest-xml-matcher';
import {getModuleSource, readPathAsString} from './util';
import {runXsltLoader} from './xslt-loader.test';

test('msTeiPreFilter converts full item TEI to required XML format', async () => {
    const stats = await runXsltLoader({
        stylesheetPath: '../src/xslt/tei-to-internal-json/msTeiPreFilter.xsl',
        inputPath: './data/tei/tei-full-item.xml',
    });

    const data: string = await readPathAsString('./data/tei/tei-prefiltered-item.xml');
    expect(JSON.parse(getModuleSource('./data/tei/tei-full-item.xml', stats))).toEqualXML(data);
});

test('jsonDocFomatter converts full item XML to internal JSON format', async () => {
    const stats = await runXsltLoader({
        stylesheetPath: '../src/xslt/tei-to-internal-json/jsonDocFormatter.xsl',
        inputPath: './data/tei/tei-prefiltered-item.xml',
    });

    const data: string = await readPathAsString('./data/tei/tei-json-output.json');
    expect(JSON.parse(JSON.parse(getModuleSource('./data/tei/tei-prefiltered-item.xml', stats))))
        .toEqual(JSON.parse(data));
});

test('msTeiPreFilter converts small item TEI to required XML format', async () => {
    const stats = await runXsltLoader({
        stylesheetPath: '../src/xslt/tei-to-internal-json/msTeiPreFilter.xsl',
        inputPath: './data/tei/tei-small-item.xml',
    });

    const data: string = await readPathAsString('./data/tei/tei-small-prefiltered-item.xml');
    expect(JSON.parse(getModuleSource('./data/tei/tei-small-item.xml', stats))).toEqualXML(data);
});

test('jsonDocFomatter converts small item XML to internal JSON format', async () => {
    const stats = await runXsltLoader({
        stylesheetPath: '../src/xslt/tei-to-internal-json/jsonDocFormatter.xsl',
        inputPath: './data/tei/tei-small-prefiltered-item.xml',
    });

    const data: string = await readPathAsString('./data/tei/tei-small-json-output.json');
    expect(JSON.parse(JSON.parse(getModuleSource('./data/tei/tei-small-prefiltered-item.xml', stats))))
        .toEqual(JSON.parse(data));
});
