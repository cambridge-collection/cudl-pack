import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';
import {parseDlDatasetJson, parseDlDatasetXml} from '../src/dl-dataset';
import {validateDlDataset} from '../src/schemas';
import {getSchemaData, NegativeSchemaTestCase} from './util';

async function readData(...relPath: string[]): Promise<Buffer> {
    return await promisify(fs.readFile)(
        path.resolve(__dirname, ...relPath));
}

async function readString(...relPath: string[]): Promise<string> {
    const data = await readData(...relPath);
    return data.toString('utf-8');
}

test('parseDlDatasetXml() should return a valid dl-dataset instance', async () => {
    const xml = await readData('./data/example.dl-dataset.xml');

    const dlDataset = await parseDlDatasetXml(xml);
    validateDlDataset(dlDataset);
    expect(dlDataset).toEqual({
        '@type': 'https://schemas.cudl.lib.cam.ac.uk/package/v1/dl-dataset.json',
        'name': 'John Rylands',
        'collections': [
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

test.each([
    'invalid_no_name.dl-dataset.xml',
    'invalid_no_collections.dl-dataset.xml',
    'invalid_bad_collection.dl-dataset.xml',
])('parseDlDatasetXml() on %s should raise an error about invalid XML', async (badXmlFile) => {
    const xml = await readData('./data', badXmlFile);

    await expect(parseDlDatasetXml(xml)).rejects.toThrowError(/^Parsed dl-dataset XML is invalid: /);
});

test('parseDlDatasetJson()', async () => {
    const json = await readString(require.resolve(
        'cudl-schema-package-json/tests/dl-dataset/valid/multiple-collections.json'));

    expect(parseDlDatasetJson(json)).toEqual({
        '@type': 'https://schemas.cudl.lib.cam.ac.uk/package/v1/dl-dataset.json',
        'name': 'John Rylands',
        'collections': [
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

test.each(getSchemaData()['dl-dataset'].validTestCases)
('parseDlDatasetJson() parses valid dl-dataset %s and returns its JSON representation', async (dlDatasetPath) => {
    const json = (await readData(require.resolve(dlDatasetPath))).toString();

    await expect(parseDlDatasetJson(json)).toEqual(JSON.parse(json));
});

test.each(getSchemaData()['dl-dataset'].invalidTestCases)
('parseDlDatasetJson() rejects invalid collection described by %s', async (testcasePath) => {
    const tc = await NegativeSchemaTestCase.fromPath(require.resolve(testcasePath));
    const invalidDlDataset = await tc.getPatchedJSON();

    expect(() => parseDlDatasetJson(JSON.stringify(invalidDlDataset))).toThrowError(`\
input does not match the https://schemas.cudl.lib.cam.ac.uk/package/v1/dl-dataset.json schema:`);
});
