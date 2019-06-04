/**
 * A loader which resolves references to other JSON modules and inlines them.
 *
 * This is basically a workaround for not having a proper custom JSON module,
 * with a parser that can find references in the module.
 *
 * The loader finds "@id" keys on objects and treats their value as a module
 * path to resolveUrls. The value of the resolved module replaces the object
 * containing the "@id" key.
 *
 * Because the parent is replaced, "@id" references should only be used in
 * objects in which the reference is the only value.
 */
import assert from 'assert';
import parseJson from 'json-parse-better-errors';
import jsonpath from 'jsonpath';
import {urlToRequest} from 'loader-utils';
import fp from 'lodash/fp';
import {RawSourceMap} from 'source-map';
import * as util from 'util';
import webpack from 'webpack';

import {bindPromiseToCallback, createAsyncLoader, createAsyncLoaderFromMethod} from '../utils';

type PathComponent = string | number;
type Path = PathComponent[];

/**
 * A point in a JSON tree that is to be substituted with the result of resolving a module reference.
 */
interface Reference {
    substitutionPoint: Path;
    reference: string;
}

interface JSONPathReferenceSelector {
    expression: string;
    substitutionLevel: number;
}

type ReferenceSelector = (options: {context: webpack.loader.LoaderContext, json: any}) => Reference[];

class JsonDependenciesLoader {
    public static matchReferencesFromJSONPath(
        references: string | string[] | JSONPathReferenceSelector | JSONPathReferenceSelector[],
    ): JsonDependenciesLoader {
        const selectors: JSONPathReferenceSelector[] = (Array.isArray(references) ? references : [references])
            .map((ref) => (typeof ref === 'string' ?
                {expression: ref, substitutionLevel: 0} : ref));

        for(const selector of selectors) {
            if(selector.substitutionLevel < 0) {
                throw new Error(`substitutionLevel cannot be negative: ${selector.substitutionLevel}`);
            }
        }

        return new JsonDependenciesLoader((options: {context: webpack.loader.LoaderContext, json: any}) => {
            return selectReferencesWithJSONPath(options.context, selectors, options.json);
        });
    }

    public readonly load: (this: webpack.loader.LoaderContext, source: string) => void;
    private readonly refSelector: ReferenceSelector;

    constructor(refSelector: ReferenceSelector) {
        this.refSelector = refSelector;

        this.load = createAsyncLoaderFromMethod(this._load, this);
    }

    private async _load(context: webpack.loader.LoaderContext, source: string): Promise<string> {
        return load(context, source, this.refSelector);
    }
}

interface Node {
    path: jsonpath.PathComponent[];
    value: any;
}

interface ReferenceNode extends Node, JSONPathReferenceSelector { }

function selectReferencesWithJSONPath(context: webpack.loader.LoaderContext,
                                      selectors: JSONPathReferenceSelector[], json: any): Reference[] {
    const [referenceNodes, ignoredNodes] = fp.pipe(
        fp.flatMap((selector: JSONPathReferenceSelector): ReferenceNode[] => {
            return fp.map((node: Node) => {
                // JSONPath paths always start with '$', drop that
                let path = node.path.slice(1);
                const end = path.length - selector.substitutionLevel;
                if(end < 0) {
                    throw Error(`\
JSONPath expression matched a reference too close to the document root for the substitutionLevel: \
${selector.substitutionLevel}, matched path:, ${util.inspect(node.path)}, expression: ${selector.expression}`);
                }
                assert(end <= path.length);
                path = path.slice(0, end);

                return {...selector, value: node.value, path};
            })(jsonpath.nodes(json, selector.expression));
        }),
        fp.sortBy((node) => node.path.join('.')),
        fp.partition((node) => typeof node.value === 'string'),
    )(selectors);

    for(const ignoredNode of ignoredNodes) {
        context.emitWarning(`Ignoring non-string reference value at \
${util.inspect(ignoredNode.path)}, selected by ${ignoredNode.expression}: \
${util.inspect(ignoredNode.value)}`);
    }

    return referenceNodes.map((node) => ({substitutionPoint: node.path, reference: node.value}));
}

async function load(
    context: webpack.loader.LoaderContext, source: string, selectReferences: ReferenceSelector,
): Promise<string> {

    let json = parseJson(source);
    const referenceNodes = selectReferences({context, json});

    json = await resolveReferences(context, json, referenceNodes);
    return JSON.stringify(json);
}

async function resolveReferences(
    context: webpack.loader.LoaderContext, json: any, references: Reference[],
): Promise<any> {

    const resolvedReferences = await Promise.all(
        references.map((ref) => resolveReference(context, ref.reference)
            .then((result) => ({...ref, result}))));

    return resolvedReferences.reduce((jsonRoot, ref) => {
        if(ref.substitutionPoint.length === 0) {
            // We're replacing the root value
            return ref.result;
        }
        else {
            const [parentPath, leafAttr] = [
                ref.substitutionPoint.slice(0, -1), ref.substitutionPoint[ref.substitutionPoint.length - 1]];
            const parent = parentPath.length === 0 ? jsonRoot : fp.get(parentPath)(jsonRoot);

            if(parent === undefined) {
                context.emitWarning(`\
Substitution point ${util.inspect(ref.substitutionPoint)} for reference to ${util.inspect(ref.reference)} does not \
exist`);
                return jsonRoot;
            }

            // Could have some kind of merge function here to combine the existing value with the merged value.
            // However I think the right thing to do is to implement an actual JSON-LD module type which can
            // natively represent references, rather than trying to enhance this workaround for baseline JSON
            // modules.
            parent[leafAttr] = ref.result;
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

// Was going to support specifying the ReferenceSelector used by the loader, but
// that's a faff as you have to configure the loader via constant data values,
// you can't pass functions. Can work around by pre-defining ReferenceSelector
// by name, then specifying a name via loader options if required...
const loader: webpack.loader.Loader = JsonDependenciesLoader.matchReferencesFromJSONPath({
    expression: '$..["@id"]', substitutionLevel: 1}).load;

export default loader;
