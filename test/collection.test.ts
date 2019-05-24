import jsonpatch from 'fast-json-patch';
import fs from 'fs';
import json5 from 'json5';
import path from 'path';
import url from 'url';
import {promisify} from 'util';
import {parseCollectionJson} from '../src/collection';
import {dirUrl, resolve} from './util';

async function readData(target: string): Promise<string> {
    if(target.startsWith('file://')) {
        target = url.fileURLToPath(target);
    }
    return (await promisify(fs.readFile)(path.resolve(__dirname, target))).toString();
}

test.each([
    'kitchen-sink.json',
    'minimal.json',
    '../minimal/collections/hebrew.collection.json',
])(
    'parseCollectionJson() loads valid collection data/collections/%s and outputs its JSON representation',
    async (name: string) => {
        const file = `data/collections/${name}`;
        const json = await readData(file);
        expect(parseCollectionJson(json, {inputDescription: file, verbose: true})).toEqual(JSON.parse(json));
    },
);

const invalidTestCases = fs.readdirSync(path.resolve(__dirname, 'data/collections/invalid'), 'utf-8');
expect(invalidTestCases.length).toEqual(2);

test.each(invalidTestCases)
('parseCollectionJson() rejects invalid collection described by data/collections/invalid/%s', async (name: string) => {
    const testFile = resolve(dirUrl(__dirname), 'data/collections/invalid/', name);
    const desc = json5.parse(await readData(testFile));
    const collectionPath = resolve(testFile, desc.base);
    const baseCollection = parseCollectionJson(
        await readData(resolve(testFile, desc.base)), {inputDescription: collectionPath, verbose: true});
    const [badCollection, _] = jsonpatch.applyPatch(baseCollection, desc.patch);
    const badCollectionJson = JSON.stringify(badCollection);

    expect(() => parseCollectionJson(badCollectionJson, {inputDescription: `patched ${desc.base}`}))
        .toThrow(desc.expectedError);
});
