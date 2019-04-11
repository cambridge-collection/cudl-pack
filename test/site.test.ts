import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';
import {parseSiteXml} from '../src/site';

test('loadSiteXml parses name', async () => {
    const xml = await promisify(fs.readFile)(
        path.resolve(__dirname, './data/site.xml'));

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
