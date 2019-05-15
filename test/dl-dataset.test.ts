import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';
import {parseDlDatasetJson, parseDlDatasetXml} from '../src/dl-dataset';

async function readData(...relPath: string[]): Promise<Buffer> {
    return await promisify(fs.readFile)(
        path.resolve(__dirname, ...relPath));
}

async function readString(...relPath: string[]): Promise<string> {
    const data = await readData(...relPath);
    return data.toString('utf-8');
}

test('parseDlDatasetXml()', async () => {
    const xml = await readData('./data/example.dl-dataset.xml');

    expect((await parseDlDatasetXml(xml))).toEqual({
        name: 'John Rylands',
        collections: [
            {'@id': 'collections/hebrew'},
            {'@id': 'collections/petrarch'},
            {'@id': 'collections/landscapehistories'},
            {'@id': 'collections/treasures'},
            {'@id': 'collections/sassoon'},
            {'@id': 'collections/lewisgibson'},
            {'@id': 'collections/darwinhooker'},
            {'@id': 'collections/japanese'},
            {'@id': 'collections/tennyson'},
        ],
    });
});

test.each`
    badXmlFile
    ${'invalid_no_name.dl-dataset.xml'}
    ${'invalid_no_collections.dl-dataset.xml'}
    ${'invalid_bad_collection.dl-dataset.xml'}
`('should raise an error when parsing file containing invalid XML: $badXmlFile', async ({badXmlFile}) => {
    const xml = await readData('./data', badXmlFile);

    await expect(parseDlDatasetXml(xml)).rejects.toThrowError(/^Parsed dl-dataset XML is invalid: /);
});

test('parseDlDatasetJson()', async () => {
    const json = await readString('./data/example.dl-dataset.json');

    expect(parseDlDatasetJson(json)).toEqual({
        name: 'John Rylands',
        collections: [
            {'@id': 'collections/hebrew'},
            {'@id': 'collections/petrarch'},
            {'@id': 'collections/landscapehistories'},
            {'@id': 'collections/treasures'},
            {'@id': 'collections/sassoon'},
            {'@id': 'collections/lewisgibson'},
            {'@id': 'collections/darwinhooker'},
            {'@id': 'collections/japanese'},
            {'@id': 'collections/tennyson'},
        ],
    });
});

test.each`
    badJsonFile
    ${'invalid_no_name.dl-dataset.json'}
    ${'invalid_no_collections.dl-dataset.json'}
    ${'invalid_bad_collection.dl-dataset.json'}
`('should raise an error when parsing file containing invalid JSON: $badJsonFile', async ({badJsonFile}) => {
    const json = await readString('./data', badJsonFile);

    await expect(() => { parseDlDatasetJson(json); })
        .toThrowError(/^dl-dataset JSON is invalid: /);
});
