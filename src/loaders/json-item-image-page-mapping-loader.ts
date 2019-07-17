import fs from 'fs';
import loaderUtils from 'loader-utils';
import path from 'path';
import util from 'util';
import webpack from 'webpack';
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

interface CSVRow {
    Filename: string;
    Foliation: string;
    [key: string]: string;
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

async function parseCSV(csvPath: string): Promise<object[]> {
    const csv = require('neat-csv');

    const readFile = util.promisify(fs.readFile);
    const csvFile = await readFile(csvPath);
    return csv(csvFile, { separator: '|', headers: ['Filename', 'Foliation'] });

}

async function load(this: webpack.loader.LoaderContext, source: string): Promise<string> {

    // Get the image server path and image type parameters
    const options = loaderUtils.getOptions(this);
    if (!options.imageServerPath || !options.imageType) {
        return Promise.reject('You need to set the imageServerPath and imageType parameters in your loader options.');
    }
    const imageServerPath = (options as Options).imageServerPath;
    const imageType = (options as Options).imageType;

    // Find the path to the CSV pagination in the JSON item data.
    const json = JSON.parse(source);

    let csvPath = null;

    for (const dataItem of json.data) {
        const type = dataItem['@type'];
        const role = dataItem['@role'];
        if (type === 'cdl-data:link' &&
           role === 'cdl-role:pagination') {
            csvPath = dataItem.href['@id'];
        }
    }

    // If there is no pagination linked in the metadata return the source JSON unchanged.
    if (!csvPath) {
        return source;
    }

    // Validate and parse the CSV
    csvPath = path.resolve(path.dirname(this.resource), csvPath);
    const csv: object[] = await parseCSV(csvPath);

    // Generate the item JSON pages section from the pagination information.
    let order: number = 1;
    const newPages: JSONPage[] = [];
    for (const row of csv) {

        const filename = (row as CSVRow).Filename;
        const foliation = (row as CSVRow).Foliation;

        const page: JSONPage = {
                    label: foliation,
                    resources:  JSON.parse('{ "@type": "cdl-page:image",' +
                        '"imageType": "' + imageType + '",' +
                        '"image": {"@id": "' + imageServerPath + filename + '"}' +
                        '}'),
                    order: order.toString(),
        };

        newPages.push(page);
        order++;
    }

    // Insert into the item package JSON and return.
    json.pages = newPages;

    return JSON.stringify(json);

}

export default createAsyncLoader(load);
