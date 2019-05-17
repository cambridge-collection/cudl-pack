/**
 * A loader which resolves references to other JSON modules and inlines them.
 *
 * This is basically a workaround for not having a proper custom JSON module,
 * with a parser that can find references in the module.
 *
 * The loader accepts a list of JSON path expressions in its `references`
 * option. Elements in the JSON matching those expressions are treated as module
 * references and they're resolved by webpack.
 */
import assert from 'assert';
import parseJson from 'json-parse-better-errors';
import jsonpath from 'jsonpath';
import {getOptions, urlToRequest} from 'loader-utils';
import fp from 'lodash/fp';
import validateOptions from 'schema-utils';
import {RawSourceMap} from 'source-map';
import * as util from 'util';
import webpack from 'webpack';

import {bindPromiseToCallback} from '../utils';

const loader: webpack.loader.Loader = function(source: string) {
    bindPromiseToCallback(load.call(this, source), this.async());
};

const optionsSchema = {
    type: 'object',
    properties: {
        references: {
            oneOf: [
                { type: 'null' },
                { type: 'string' },
                { type: 'array', items: { type: 'string' } },
            ],
        },
    },
};

enum ReferenceReplacement {
    Self = 'self',
    Parent = 'parent',
}

interface ReferenceSelector {
    path: string;
    replace: ReferenceReplacement;
}

interface InputOptions {
    references?: string | ReferenceSelector | string[] | ReferenceSelector[];
}

interface NormalisedOptions {
    referenceSelectors: ReferenceSelector[];
}

function getNormalisedOptions(loaderContext: webpack.loader.LoaderContext): NormalisedOptions {
    const options = getOptions(loaderContext) || {};
    validateOptions(optionsSchema, options);
    const iOpts = options as InputOptions;

    const references = (Array.isArray(iOpts.references) ?
        iOpts.references : [iOpts.references]);

    return {
        referenceSelectors: references.map((ref) => (typeof ref === 'string' ?
            {path: ref, replace: ReferenceReplacement.Self} : ref)),
    };
}

async function load(this: webpack.loader.LoaderContext, source: string): Promise<string> {
    let json = parseJson(source);

    const options = getNormalisedOptions(this);

    const [referenceNodes, ignoredNodes] = selectReferences(
        json, options.referenceSelectors || []);

    for(const ignoredNode of ignoredNodes) {
        this.emitWarning(`Ignoring non-string reference value at \
${util.inspect(ignoredNode.path)}, selected by ${ignoredNode.selector.path}: \
${util.inspect(ignoredNode.value)}`);
    }

    json = await resolveReferences(this, json, referenceNodes);
    return JSON.stringify(json);
}

interface Node {
    path: jsonpath.PathComponent[];
    value: any;
}

interface ReferenceNode extends Node {
    selector: ReferenceSelector;
}

function selectReferences(root: object, selectors: ReferenceSelector[]) {
    return fp.pipe(
        fp.flatMap((selector: ReferenceSelector): ReferenceNode[] => {
            return fp.map((node: Node) => {
                return {selector, ...node};
            })(jsonpath.nodes(root, selector.path));
        }),
        fp.sortBy((node) => node.path.join('.')),
        fp.partition((node) => typeof node.value === 'string'),
    )(selectors);
}

async function resolveReferences(context: webpack.loader.LoaderContext, json: any, nodes: ReferenceNode[]):
        Promise<any> {

    // We filter out non-string matches in order to avoid the problem of
    // references matching parent objects of other references (and needing to
    // replace the parents, or resolve references in the replaced value).
    assert(nodes.every((node) => typeof node.value === 'string'));

    const resolvedReferences = await Promise.all(
        nodes.map((node) => resolveReference(context, node.value)
            .then((result) => ({...node, result}))));

    return resolvedReferences.reduce((jsonRoot, node) => {
        if(node.path.length === 0 || node.path[0] !== '$') {
            throw Error(`Unsupported path: ${util.inspect(node.path)}`);
        }

        let path = node.path;
        if(node.selector.replace === ReferenceReplacement.Parent) {
            if(node.path.length === 1) {
                throw Error('Attempted to replace parent of reference value at document root');
            }
            path = node.path.slice(0, -1);
        }

        if(path.length === 1) {
            // We're replacing the root value
            return node.result;
        }
        else {
            assert(path.length > 1);
            const [parentPath, leafAttr] = [
                path.slice(1, -1), path[path.length - 1]];
            const parent = parentPath.length === 0 ? jsonRoot : fp.get(parentPath)(jsonRoot);

            if(node.selector.replace === ReferenceReplacement.Self) {
                assert(typeof parent[leafAttr] === 'string');
            }
            else {
                if(fp.size(parent[leafAttr]) !== 1) {
                    // Could have some kind of merge function here to combine the existing value with the merged value.
                    // However I think the right thing to do is to implement an actual JSON-LD module type which can
                    // natively represent references, rather than trying to enhance this workaround for baseline JSON
                    // modules.
                    context.emitWarning(
`Replaced parent of a dependency reference contains values other than the \
reference which will be lost. path: ${util.inspect(path)}, selected by: \
${node.selector.path}, value: ${util.inspect(node.value)}\``);
                }
            }

            parent[leafAttr] = node.result;
            return jsonRoot;
        }
    }, json);
}

function resolveReference(context: webpack.loader.LoaderContext, reference: string) {
    const request = urlToRequest(reference, context.rootContext);

    return loadModule(context, request).then(({source, module}) => {
        try {
            return parseJson(source);
        }
        catch(e) {
            return Promise.reject(new Error(`\
Unable to parse referenced module as JSON. module type: ${module.type}, \
reference: ${util.inspect(reference)}, parse error: ${e}`));
        }
    }).catch((reason) => {
        return Promise.reject(new Error(`\
Unable to load module referenced by: ${util.inspect(reference)}: ${reason}`));
    });
}

interface WebpackModule extends webpack.Module {
    type: string;
}

interface LoadedModule {
    source: string;
    sourceMap: RawSourceMap;
    module: WebpackModule;
}

function loadModule(loaderContext: webpack.loader.LoaderContext, request: string): Promise<LoadedModule> {
    return new Promise((resolve, reject) => {
        loaderContext.loadModule(request, (err, source, sourceMap, module: WebpackModule) => {
            if(err) { reject(err); }
            else { resolve({source, sourceMap, module}); }
        });
    });
}

export default loader;
