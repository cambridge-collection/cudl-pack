import {promisify} from 'util';
import webpack from 'webpack';
import xml2js from 'xml2js';

const parseXml: (xml: string) => Promise<object> = promisify(new xml2js.Parser().parseString);

const loader: webpack.loader.Loader = function(source: string) {
    const callback = this.async();

    parseXml(source).then((xml) => {
        callback(null, JSON.stringify({foo: 123}));
    }, (err) => {
        callback(err);
    });
}

export default loader;
