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
import Ajv from "ajv";
import ajvKeywords from "ajv-keywords";
import assert from "assert";
import clone from "clone";
import parseJson from "json-parse-better-errors";
import jsonpath from "jsonpath";
import { urlToRequest } from "loader-utils";
import fp from "lodash/fp";
import { RawSourceMap } from "source-map";
import * as tapable from "tapable";
import * as util from "util";
import webpack from "webpack";
import webpackLog from "webpack-log";
import { createValidator } from "../schemas";

import { AsyncLoadFunction, createAsyncLoader } from "../utils";
import optionsSchemaJSON from "./json-dependencies-loader-options.schema.json";

const log = webpackLog({
    name: "cudl-pack/loaders/json-dependencies-loader",
    unique: false,
});

export interface Reference {
    request: string;
}

export interface ResolvedReference extends Reference {
    resolvedRequest: LoadedModule;
}

export interface IgnoredReference extends Reference {
    resolvedRequest: IgnoredModule;
}

function isIgnoredReference(ref: Reference): ref is IgnoredReference {
    return (
        (ref as Record<keyof IgnoredReference, unknown>)
            .resolvedRequest instanceof IgnoredModule
    );
}

export interface LoadedReference extends ResolvedReference {
    loadedRequest: unknown;
}

export interface HandleReferenceResult {
    doc: unknown;
    docChanged: boolean;
}

export class DependencyResolutionHooks {
    /** Parse the incoming JSON document. */
    public readonly load = new tapable.AsyncSeriesBailHook<
        [string, webpack.LoaderContext<Record<string, unknown>>, string],
        unknown
    >(["source", "context", "request"]);

    public readonly findReferences = new tapable.AsyncSeriesWaterfallHook<
        [Reference[], unknown, webpack.LoaderContext<Record<string, unknown>>]
    >(["references", "doc", "context"]);

    public readonly resolveReference = new tapable.AsyncSeriesBailHook<
        [Reference, unknown, webpack.LoaderContext<Record<string, unknown>>],
        ResolvedReference | IgnoredReference
    >(["reference", "doc", "context"]);

    public readonly handleIgnoredModule = new tapable.AsyncParallelHook<
        [
            IgnoredReference,
            unknown,
            webpack.LoaderContext<Record<string, unknown>>
        ]
    >(["ignored", "doc", "context"]);

    public readonly handleReference = new tapable.SyncWaterfallHook<
        [
            HandleReferenceResult,
            {
                reference: LoadedReference;
                doc: unknown;
                context: webpack.LoaderContext<Record<string, unknown>>;
            }
        ]
    >(["result", "options"]);

    public readonly dump = new tapable.AsyncSeriesBailHook<
        [
            HandleReferenceResult,
            webpack.LoaderContext<Record<string, unknown>>,
            string
        ],
        string
    >(["result", "context", "source"]);
}

export type PluginFunction = (hooks: DependencyResolutionHooks) => void;
export interface PluginObject {
    apply: PluginFunction;
}
type Plugin = PluginFunction | PluginObject;

/** Implements baseline loader functionality. */
export class DefaultsPlugin implements PluginObject {
    public static readonly TAP_NAME = "DefaultsPlugin";
    public static readonly TAP_STAGE = 100;

    public apply(hooks: DependencyResolutionHooks): void {
        const options = {
            name: DefaultsPlugin.TAP_NAME,
            // Tap with a higher stage than the default (0) so that anyone tapping hooks will get their version run
            // first by default.
            stage: DefaultsPlugin.TAP_STAGE,
        };

        hooks.load.tap(options, (source, context, request) => {
            try {
                return parseJson(source);
            } catch (e) {
                const type =
                    request === context.request ? "main" : "referenced";
                throw new Error(
                    `Unable to parse ${type} module as JSON. request: ${request}, parse error: ${e}`
                );
            }
        });
        hooks.resolveReference.tapPromise(
            options,
            async (reference, doc, context) => {
                try {
                    const module = await loadModule(context, reference.request);
                    return { ...reference, resolvedRequest: module };
                } catch (e) {
                    if (e instanceof IgnoredModule) {
                        return { ...reference, resolvedRequest: e };
                    }
                    throw new Error(
                        `Unable to load module referenced by: ${reference.request} : ${e}`
                    );
                }
            }
        );
        hooks.handleIgnoredModule.tap(options, (ignored, doc, context) => {
            log.debug(
                `Ignored module referenced by ${context.resourcePath}: ${ignored.request}`
            );
        });
        hooks.dump.tap(options, (result, context, source) =>
            result.docChanged ? JSON.stringify(result.doc) : source
        );
    }
}

type PathComponent = string | number;
type Path = PathComponent[];

/**
 * A point in a JSON tree that is to be substituted with the result of resolving a module reference.
 */
interface AncestorSubstitutionReference extends Reference {
    substitutionPoint: Path;
}

function isAncestorSubstitutionReference(
    ref: Reference
): ref is AncestorSubstitutionReference {
    const asr = ref as Record<keyof AncestorSubstitutionReference, unknown>;
    if (Array.isArray(asr.substitutionPoint)) {
        return asr.substitutionPoint.every(
            (x) => typeof x === "string" || typeof x === "number"
        );
    }
    return false;
}

export interface JSONPathReferenceSelector {
    expression: string;
    substitutionLevel: number;
}

export type AncestorSubstitutionReferenceSelector = (options: {
    context: webpack.LoaderContext<Record<string, unknown>>;
    json: unknown;
}) => AncestorSubstitutionReference[];

/** Implements the options.references behaviour. */
class ReferenceSelectorPlugin implements PluginObject {
    private readonly refSelector: AncestorSubstitutionReferenceSelector;

    constructor(refSelector: AncestorSubstitutionReferenceSelector) {
        this.refSelector = refSelector;
    }

    public apply(hooks: DependencyResolutionHooks): void {
        hooks.findReferences.tap(
            "ReferenceSelectorPlugin",
            (references, json, context) => {
                return references.concat(this.refSelector({ context, json }));
            }
        );
        hooks.handleReference.tap(
            "ReferenceSelectorPlugin",
            (result, { reference, doc, context }) => {
                if (!isAncestorSubstitutionReference(reference)) {
                    return result;
                }

                const newResult = insertReference(doc, reference, context);
                return {
                    doc: newResult.doc,
                    docChanged: result.docChanged || newResult.docChanged,
                };
            }
        );
    }
}

interface Node {
    path: jsonpath.PathComponent[];
    value: unknown;
}

interface ReferenceNode extends Node, JSONPathReferenceSelector {}

export function selectReferencesWithJSONPath(
    context: webpack.LoaderContext<Record<string, unknown>>,
    selectors: JSONPathReferenceSelector[],
    json: unknown
): AncestorSubstitutionReference[] {
    const [referenceNodes, ignoredNodes] = fp.pipe(
        fp.flatMap((selector: JSONPathReferenceSelector): ReferenceNode[] => {
            return fp.map((node: Node) => {
                // JSONPath paths always start with '$', drop that
                let path = node.path.slice(1);
                const end = path.length - selector.substitutionLevel;
                if (end < 0) {
                    throw Error(`\
JSONPath expression matched a reference too close to the document root for the substitutionLevel: \
${selector.substitutionLevel}, matched path:, ${util.inspect(
                        node.path
                    )}, expression: ${selector.expression}`);
                }
                assert(end <= path.length);
                path = path.slice(0, end);

                return { ...selector, value: node.value, path };
            })(jsonpath.nodes(json, selector.expression));
        }),
        fp.sortBy((node) => node.path.join(".")),
        fp.partition((node) => typeof node.value === "string")
    )(selectors);

    for (const ignoredNode of ignoredNodes) {
        context.emitWarning(
            new Error(`Ignoring non-string reference value at \
${util.inspect(ignoredNode.path)}, selected by ${ignoredNode.expression}: \
${util.inspect(ignoredNode.value)}`)
        );
    }

    return referenceNodes.map((node) => {
        const reference = node.value;
        // Guaranteed by preceding code ignoring nodes with non-string values.
        assert(typeof reference === "string");
        return {
            substitutionPoint: node.path,
            request: urlToRequest(reference),
        };
    });
}

function insertReference(
    jsonRoot: unknown,
    ref: LoadedReference & AncestorSubstitutionReference,
    context: webpack.LoaderContext<Record<string, unknown>>
): HandleReferenceResult {
    if (ref.substitutionPoint.length === 0) {
        // We're replacing the root value
        return { doc: ref.loadedRequest, docChanged: true };
    } else {
        const [parentPath, leafAttr] = [
            ref.substitutionPoint.slice(0, -1),
            ref.substitutionPoint[ref.substitutionPoint.length - 1],
        ];
        const parent =
            parentPath.length === 0 ? jsonRoot : fp.get(parentPath)(jsonRoot);

        if (parent === undefined) {
            context.emitWarning(
                new Error(`\
Substitution point ${util.inspect(
                    ref.substitutionPoint
                )} for reference to ${util.inspect(ref.request)} does not \
exist`)
            );
            return { doc: jsonRoot, docChanged: false };
        }

        // Could have some kind of merge function here to combine the existing value with the merged value.
        // However I think the right thing to do is to implement an actual JSON-LD module type which can
        // natively represent references, rather than trying to enhance this workaround for baseline JSON
        // modules.
        parent[leafAttr] = ref.loadedRequest;
        return { doc: jsonRoot, docChanged: true };
    }
}

export interface LoadedModule {
    source: string;
    sourceMap?: RawSourceMap;
    module?: webpack.Module;
}

export class IgnoredModule extends Error {}

function loadModule(
    loaderContext: webpack.LoaderContext<Record<string, unknown>>,
    request: string
): Promise<LoadedModule> {
    const logger = loaderContext.getLogger();
    return new Promise((resolve, reject) => {
        logger.info(`Calling loadModule() for request: '${request}'`);
        loaderContext.loadModule(
            request,
            (err, source, sourceMap, module: webpack.Module) => {
                logger.info(
                    `loadModule() called back for request: '${request}', failed?: ${!!err}`
                );
                if (err) {
                    // Webpack allows modules to be ignored, e.g. via the NormalModuleFactory beforeResolve hook.
                    // However the LoaderContext.loadModule() method doesn't handle ignored modules, and fails with the
                    // following error if it gets no module from its load request.
                    if (err.message === "Cannot load the module") {
                        reject(
                            new IgnoredModule(`${request} is an ignored module`)
                        );
                    }
                    reject(err);
                } else {
                    resolve({ source, sourceMap, module });
                }
            }
        );
    });
}

interface Options {
    references?:
        | string
        | string[]
        | JSONPathReferenceSelector
        | JSONPathReferenceSelector[]
        | AncestorSubstitutionReferenceSelector;
    plugins?: Plugin[];
}

const ajv = new Ajv();
ajvKeywords(ajv, "typeof");

const validateOptions = createValidator<Options>({
    schemaId: "cudl-pack/loaders/json-dependencies-loader-options.schema.json",
    validate: ajv.compile(optionsSchemaJSON),
    name: "options",
});

const defaultReferenceSelector: JSONPathReferenceSelector = {
    expression: '$..["@id"]',
    substitutionLevel: 1,
};

function pluginAsFunction(plugin: Plugin): PluginFunction {
    return typeof plugin === "function"
        ? (plugin as PluginFunction)
        : plugin.apply.bind(plugin);
}

function getPlugins(options: Options): PluginFunction[] {
    const plugins = [pluginAsFunction(new DefaultsPlugin())];

    if (options.references !== undefined || options.plugins === undefined) {
        let referenceSelector: AncestorSubstitutionReferenceSelector;
        if (typeof options.references === "function")
            referenceSelector = options.references;
        else {
            const jsonpathSelectors: JSONPathReferenceSelector[] = (
                Array.isArray(options.references)
                    ? options.references
                    : [options.references || defaultReferenceSelector]
            ).map((ref) => {
                if (typeof ref === "string")
                    return { expression: ref, substitutionLevel: 0 };
                else return ref;
            });
            referenceSelector = ({ context, json }) =>
                selectReferencesWithJSONPath(context, jsonpathSelectors, json);
        }
        plugins.push(
            pluginAsFunction(new ReferenceSelectorPlugin(referenceSelector))
        );
    }

    plugins.push(...(options.plugins || []).map(pluginAsFunction));
    return plugins;
}

const loader: AsyncLoadFunction = async function (
    this: webpack.LoaderContext<Record<string, unknown>>,
    source: string | Buffer
): Promise<string> {
    const options = validateOptions(clone(this.getOptions()));
    const plugins = getPlugins(options);

    const hooks = new DependencyResolutionHooks();
    plugins.forEach((p) => p(hooks));

    const json = await hooks.load.promise(
        source.toString(),
        this,
        this.request
    );
    let result: HandleReferenceResult = { doc: json, docChanged: false };
    const references: Reference[] = await hooks.findReferences.promise(
        [],
        json,
        this
    );
    for (const ref of references) {
        const resolvedRef = await hooks.resolveReference.promise(
            ref,
            json,
            this
        );
        if (resolvedRef === undefined) {
            throw new Error(`${ref.request} was not resolved`);
        }

        if (isIgnoredReference(resolvedRef)) {
            hooks.handleIgnoredModule.promise(resolvedRef, json, this);
            continue;
        }

        const loadedReference: LoadedReference = {
            ...resolvedRef,
            loadedRequest: await hooks.load.promise(
                resolvedRef.resolvedRequest.source,
                this,
                resolvedRef.request
            ),
        };
        result = await hooks.handleReference.promise(result, {
            reference: loadedReference,
            doc: json,
            context: this,
        });
    }

    const output = await hooks.dump.promise(result, this, source.toString());
    if (output === undefined) {
        throw new Error("dump hook produced no output");
    }
    return output;
};

export default createAsyncLoader(loader);
export { Options as JSONDependenciesLoaderOptions };
