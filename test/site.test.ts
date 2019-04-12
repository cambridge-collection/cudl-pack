import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';
import {parseSiteJson, parseSiteXml} from '../src/site';

async function readData(...relPath: string[]): Promise<Buffer> {
    return await promisify(fs.readFile)(
        path.resolve(__dirname, ...relPath));
}

async function readString(...relPath: string[]): Promise<string> {
    const data = await readData(...relPath);
    return data.toString('utf-8');
}

test('parseSiteXml()', async () => {
    const xml = await readData('./data/site.xml');

    expect((await parseSiteXml(xml))).toEqual({
        name: 'John Rylands',
        collections: [
            {href: 'collections/hebrew'},
            {href: 'collections/petrarch'},
            {href: 'collections/landscapehistories'},
            {href: 'collections/treasures'},
            {href: 'collections/sassoon'},
            {href: 'collections/lewisgibson'},
            {href: 'collections/darwinhooker'},
            {href: 'collections/japanese'},
            {href: 'collections/tennyson'},
        ],
    });
});

test.each`
    badXmlFile
    ${'invalid_site_no_name.xml'}
    ${'invalid_site_no_collections.xml'}
    ${'invalid_site_bad_collection.xml'}
`('should raise an error when parsing file containing invalid XML: $badXmlFile', async ({badXmlFile}) => {
    const xml = await readData('./data', badXmlFile);

    await expect(parseSiteXml(xml)).rejects.toThrowError(/^Parsed site XML is invalid: /);
});

test('parseSiteJson()', async () => {
    const json = await readString('./data/site.json');

    expect(parseSiteJson(json)).toEqual({
        name: 'John Rylands',
        collections: [
            {href: 'collections/hebrew'},
            {href: 'collections/petrarch'},
            {href: 'collections/landscapehistories'},
            {href: 'collections/treasures'},
            {href: 'collections/sassoon'},
            {href: 'collections/lewisgibson'},
            {href: 'collections/darwinhooker'},
            {href: 'collections/japanese'},
            {href: 'collections/tennyson'},
        ],
    });
});

test.each`
    badJsonFile
    ${'invalid_site_no_name.json'}
    ${'invalid_site_no_collections.json'}
    ${'invalid_site_bad_collection.json'}
`('should raise an error when parsing file containing invalid JSON: $badJsonFile', async ({badJsonFile}) => {
    const json = await readString('./data', badJsonFile);

    await expect(() => { parseSiteJson(json); })
        .toThrowError(/^site JSON is invalid: /);
});
