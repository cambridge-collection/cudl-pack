import {promisify} from 'util';
import webpack from 'webpack';
import xml2js from 'xml2js';
import {bindPromiseToCallback} from '../utils';

const parseXml: (xml: string) => Promise<object> = promisify(new xml2js.Parser().parseString);

const loader: webpack.loader.Loader = function(source: string) {
    bindPromiseToCallback(load.call(this, source), this.async());
}

async function load(source: string): Promise<string> {
    return await parseXml(source)
        .then(loadSiteXml)
        .then(JSON.stringify);
}

interface Site {
    name: string;
    collections: CollectionRef[];
}

interface CollectionRef {
    href: string;
}

function loadSiteXml(siteXml: SiteXml): Site {

    return {
        name: siteXml.site.$.name,
        collections: [...getCollections(siteXml.site)],
    };
}

interface SiteXml {
    site: SiteElement;
}
interface SiteElement {
    $: {name: string};
    collections: CollectionsElement[];
}
interface CollectionsElement {
    collection: CollectionElement[];
}
interface CollectionElement {
    '$': {
        href: string;
    };
}

function* getCollections(site: SiteElement) {
    for(const collectionsEls of site.collections) {
        for(const collection of collectionsEls.collection) {
            yield {
                href: collection.$.href,
            };
        }
    }
}

export default loader;
