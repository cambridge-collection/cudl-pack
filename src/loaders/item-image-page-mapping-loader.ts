import fs from 'fs';
import loaderUtils from 'loader-utils';
import csv from 'neat-csv';
import path from 'path';
import util from 'util';
import webpack from 'webpack';
import {getData, NamespaceLoader, parseItemJson} from '../item';
import {ImageItemResource, ItemPages, Page, UriReference} from '../item-types';
import {isLinkItemData, LinkItemData} from '../item-types';
import {validateItem} from '../schemas';
import {CDLRole} from '../uris';
import {createAsyncLoader} from '../utils';

/**
 * A loader which uses the CSV image mapping defined in the additional metadata
 * section of the item JSON to generate a image-page foliation mapping and
 * insert that into the item JSON.  Generating a new item JSON with the foliation
 * and without the external mapping.
 *
 * Note: if there is already data in the pages array the contents of the linked
 * CSV resource will override this data.
 *
 * TODO: Deal with transcriptions and translations that are on a page level.
 */

interface PageMapping {
    url: string;
    label: string;
}

interface JSONPage {
    label: string;
    resources: object[];
    order: string;
    [key: string]: any;
}

interface Options {
    imageServerPath: string;
    imageType: string;
}

async function parseCSV(csvPath: string): Promise<PageMapping[]> {

    const readFile = util.promisify(fs.readFile);
    const csvFile = await readFile(csvPath);
    const parsedCSV = await csv(csvFile, { separator: '|', headers: ['url', 'label'] });
    return parsedCSV.map( (row): PageMapping => {
        // validate row exists
        if (row == null || row.url == null || row.label == null) {
            throw new Error ('Problem parsing CSV. Each row should contain <url>|<label>');
        }
        // return new restricted object
        return ({url: row.url, label: row.label});
    });

}

function isOptions(value: object): value is Options {
    return (typeof (value as Record<string, unknown>).imageServerPath === 'string' &&
        typeof (value as Record<string, unknown>).imageType === 'string');
}

async function load(this: webpack.loader.LoaderContext, source: string | Buffer): Promise<string | Buffer> {

    // Get the image server path and image type parameters
    const options = loaderUtils.getOptions(this);
    if (!isOptions(options)) {
        throw new Error('You need to set the imageServerPath and imageType parameters in your loader options.');
    }
    const imageServerPath = options.imageServerPath;
    const imageType = options.imageType;

    // Find the path to the CSV pagination in the JSON item data.
    const json = parseItemJson(source.toString());
    const item = validateItem(json);
    const ns = await NamespaceLoader.forWebpackLoader(this).loadNamespace(item);
    const paginationLinks: LinkItemData[] = getData(item, ns,
        {type: isLinkItemData, roles: CDLRole.curie.uri('pagination')});

    let csvPath = paginationLinks[0].href['@id'];

    // If there is no pagination linked in the metadata return the source JSON unchanged.
    if (!csvPath) {
        return source;
    }

    // Validate and parse the CSV
    csvPath = path.resolve(path.dirname(this.resource), csvPath);
    const pageMappings: PageMapping[] = await parseCSV(csvPath);

    // Generate the item JSON pages section from the pagination information.
    let order: number = 1;
    const pages: ItemPages = {};
    for (const pageMapping of pageMappings) {

        const image: UriReference = { '@id': imageServerPath.toString() + pageMapping.url.toString() };
        const imageResource: ImageItemResource = {'@type': 'cdl-page:image', imageType, image};

        const page: Page = {
                    label: pageMapping.label,
                    resources:  [imageResource],
                    order: order.toString().padStart(5, '0'),
        };

        pages[order] = page;
        order++;
    }

    // Insert into the item package JSON and return.
    json.pages = pages;

    return JSON.stringify(json);

}

export default createAsyncLoader(load);
