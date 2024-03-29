import path from "path";
import webpack from "webpack";
import {
    AncestorSubstitutionReferenceSelector,
    DependencyResolutionHooks,
    IgnoredModule,
    IgnoredReference,
    JSONDependenciesLoaderOptions,
    PluginObject,
    Reference,
    ResolvedReference,
} from "../src/loaders/json-dependencies-loader";
import compiler from "./compiler";
import { getModule, getModuleSource, readPathAsString } from "./util";

test("references are replaced by resolved JSON objects", async () => {
    const rules = [
        {
            test: /\.json$/,
            use: [
                {
                    loader: "../src/loaders/json-dependencies-loader.ts",
                },
            ],
        },
    ];

    const stats = await compiler("./data/references/a", rules);

    expect(getModule("./data/references/a.json", stats).moduleType).toEqual(
        "json"
    );
    expect(
        JSON.parse(getModuleSource("./data/references/a.json", stats))
    ).toEqual({
        thisIs: "a",
        b: {
            thisIs: "b",
            c: {
                thisIs: "c",
            },
        },
    });
});

test("reference pattern can be specified via options", async () => {
    const rules = [
        {
            test: /\.json$/,
            use: [
                {
                    loader: "../src/loaders/json-dependencies-loader.ts",
                    options: {
                        references: {
                            expression: '$..["href"]',
                            substitutionLevel: 1,
                        },
                    } as JSONDependenciesLoaderOptions,
                },
            ],
        },
    ];

    const stats = await compiler("./data/references/alternate-syntax", rules);

    expect(
        getModule("./data/references/alternate-syntax.json", stats).moduleType
    ).toEqual("json");
    expect(
        JSON.parse(
            getModuleSource("./data/references/alternate-syntax.json", stats)
        )
    ).toEqual({
        c: {
            thisIs: "c",
        },
    });
});

test("a user-provided function can enumerate references", async () => {
    const expectedJSONDoc = JSON.parse(
        await readPathAsString("data/references/alternate-syntax.json")
    );
    const refSelector: AncestorSubstitutionReferenceSelector = ({
        context,
        json,
    }) => {
        if (context.resourcePath.endsWith("/alternate-syntax.json")) {
            expect(json).toEqual(expectedJSONDoc);
            return [{ request: "./c.json", substitutionPoint: ["c"] }];
        } else {
            expect(context.resourcePath.endsWith("/c.json")).toBeTruthy();
            return [];
        }
    };

    const rules = [
        {
            test: /\.json$/,
            use: [
                {
                    loader: "../src/loaders/json-dependencies-loader.ts",
                    options: {
                        references: refSelector,
                    } as JSONDependenciesLoaderOptions,
                },
            ],
        },
    ];

    const stats = await compiler("./data/references/alternate-syntax", rules);

    expect(
        getModule("./data/references/alternate-syntax.json", stats).moduleType
    ).toEqual("json");
    expect(
        JSON.parse(
            getModuleSource("./data/references/alternate-syntax.json", stats)
        )
    ).toEqual({
        c: {
            thisIs: "c",
        },
    });
    expect.assertions(4);
});

test("references in arrays are replaced by resolved JSON objects", async () => {
    const rules = [
        {
            test: /\.json$/,
            use: ["../src/loaders/json-dependencies-loader.ts"],
        },
    ];

    const stats = await compiler("./data/references/ref-list", rules);

    expect(
        getModule("./data/references/ref-list.json", stats).moduleType
    ).toEqual("json");
    expect(
        JSON.parse(getModuleSource("./data/references/ref-list.json", stats))
    ).toEqual({
        references: [
            { this: "is not a ref" },
            {
                thisIs: "a",
                b: {
                    thisIs: "b",
                    c: {
                        thisIs: "c",
                    },
                },
            },
            {
                thisIs: "b",
                c: {
                    thisIs: "c",
                },
            },
            { this: "is also not a ref" },
        ],
    });
});

test("references are replaced by resolved JSON strings", async () => {
    const rules: webpack.RuleSetRule[] = [
        {
            test: /\.json$/,
            use: [
                {
                    loader: "../src/loaders/json-dependencies-loader.ts",
                },
            ],
        },
        {
            type: "json",
            test: /\.txt$/,
            use: path.resolve(__dirname, "../src/loaders/json-raw-loader.ts"),
        },
    ];

    const stats = await compiler(
        "./data/references/json-pointing-to-non-json",
        rules
    );

    expect(
        getModule("./data/references/json-pointing-to-non-json.json", stats)
            .moduleType
    ).toEqual("json");
    expect(
        JSON.parse(
            getModuleSource(
                "./data/references/json-pointing-to-non-json.json",
                stats
            )
        )
    ).toEqual({
        nonJsonThing: "Plain text.\n",
    });
});

test("references to missing modules are reported", async () => {
    const rules: webpack.RuleSetRule[] = [
        {
            test: /\.json$/,
            use: [
                {
                    loader: "../src/loaders/json-dependencies-loader.ts",
                },
            ],
        },
    ];

    await expect(
        compiler("./data/references/missing", rules)
    ).rejects.toThrowError(
        /ModuleNotFoundError: Module not found: Error: Can't resolve '\.\/does-not-exist'/
    );
});

test("referenced modules not containing JSON are reported", async () => {
    const rules: webpack.RuleSetRule[] = [
        {
            test: /\.json$/,
            use: [
                {
                    loader: "../src/loaders/json-dependencies-loader.ts",
                },
            ],
        },
        {
            type: "javascript/auto",
            test: /\.txt$/,
            use: "raw-loader",
        },
    ];

    await expect(
        compiler("./data/references/json-pointing-to-non-json", rules)
    ).rejects.toThrowError(
        /Unable to parse referenced module as JSON. request: \.\/file\.txt, parse error: SyntaxError: /
    );
});

test("references to ignored dependencies are left as-is", async () => {
    const config: webpack.Configuration = {
        entry: "./data/references/a",
        module: {
            rules: [
                {
                    test: /\.json$/,
                    use: [
                        {
                            loader: "../src/loaders/json-dependencies-loader.ts",
                        },
                    ],
                },
            ],
        },
        plugins: [
            // c.json is ignored
            new webpack.IgnorePlugin({ resourceRegExp: /c\.json$/ }),
        ],
    };

    const stats = await compiler(config);
    expect(getModule("./data/references/a.json", stats).moduleType).toEqual(
        "json"
    );
    expect(
        JSON.parse(getModuleSource("./data/references/a.json", stats))
    ).toEqual({
        thisIs: "a",
        b: {
            thisIs: "b",
            // The reference to c.json is ignored, so it remains unchanged.
            c: { "@id": "c.json" },
        },
    });
});

test("plugins can be objects with an apply method", async () => {
    class Plugin implements PluginObject {
        public apply(hooks: DependencyResolutionHooks) {
            expect(this).toStrictEqual(pluginInstance);
            expect(hooks).toBeInstanceOf(DependencyResolutionHooks);
        }
    }
    const pluginInstance = new Plugin();
    const rules = [
        {
            test: /\.json$/,
            use: [
                {
                    loader: "../src/loaders/json-dependencies-loader.ts",
                    options: {
                        plugins: [pluginInstance],
                    },
                },
            ],
        },
    ];

    await compiler("./data/references/a", rules);
    expect.assertions(2);
});

test("plugins can be functions", async () => {
    function plugin(hooks: DependencyResolutionHooks) {
        expect(hooks).toBeInstanceOf(DependencyResolutionHooks);
    }
    const rules = [
        {
            test: /\.json$/,
            use: [
                {
                    loader: "../src/loaders/json-dependencies-loader.ts",
                    options: {
                        plugins: [plugin],
                    },
                },
            ],
        },
    ];

    await compiler("./data/references/a", rules);
    expect.assertions(1);
});

type LoaderContext = webpack.LoaderContext<Record<string, unknown>>;

function isWebpackContext(obj: unknown): obj is LoaderContext {
    if (typeof obj !== "object") {
        return false;
    }
    const maybeContext = obj as Record<keyof LoaderContext, unknown>;
    return (
        maybeContext.version === 2 &&
        typeof maybeContext.loadModule === "function"
    );
}

test("plugins can control loader behaviour", async () => {
    const bDoc = () => ({
        thisIs: "b",
        c: { "@id": "c.json" },
    });
    function plugin(hooks: DependencyResolutionHooks) {
        expect(hooks).toBeDefined();
        let loadCall = 0;
        hooks.load.tapPromise(
            "test",
            async (source: string, context: LoaderContext, request: string) => {
                expect(isWebpackContext(context)).toBeTruthy();

                if (loadCall++ === 0) {
                    expect(
                        request.endsWith("/data/references/b.json")
                    ).toBeTruthy();
                    const result = JSON.parse(source);
                    expect(result).toEqual(bDoc());
                    return result;
                } else {
                    expect(request).toBe("foobar");
                    expect(source).toBe("[123]");
                    return [456];
                }
            }
        );

        hooks.findReferences.tapPromise(
            "test",
            async (
                references: Reference[],
                doc: unknown,
                context: LoaderContext
            ) => {
                expect(doc).toEqual(bDoc());
                expect(isWebpackContext(context)).toBeTruthy();
                references.push({ request: "foobar" });
                references.push({ request: "useless" });
                return references;
            }
        );

        hooks.resolveReference.tapPromise(
            "test",
            async (
                reference: Reference,
                doc: unknown,
                context: LoaderContext
            ): Promise<ResolvedReference | IgnoredReference> => {
                expect(doc).toEqual(bDoc());
                expect(isWebpackContext(context)).toBeTruthy();
                if (reference.request === "foobar") {
                    return {
                        ...reference,
                        resolvedRequest: { source: "[123]" },
                    };
                } else if (reference.request === "useless") {
                    return {
                        ...reference,
                        resolvedRequest: new IgnoredModule("msg"),
                    };
                }
                throw new Error(`unexpected request: ${reference.request}`);
            }
        );

        hooks.handleIgnoredModule.tapPromise(
            "test",
            async (
                ignored: IgnoredReference,
                doc: unknown,
                context: LoaderContext
            ) => {
                expect(ignored).toEqual({
                    request: "useless",
                    resolvedRequest: new IgnoredModule("msg"),
                });
                expect(doc).toEqual(bDoc());
                expect(isWebpackContext(context)).toBeTruthy();
            }
        );

        hooks.handleReference.tap(
            "test",
            (result, { reference, doc, context }) => {
                expect(result).toEqual({ doc: bDoc(), docChanged: false });
                expect(doc).toEqual(bDoc());
                expect(reference).toEqual({
                    request: "foobar",
                    resolvedRequest: { source: "[123]" },
                    loadedRequest: [456],
                });
                expect(isWebpackContext(context)).toBeTruthy();

                return {
                    doc: { foo: [456] },
                    docChanged: true,
                };
            }
        );

        hooks.dump.tapPromise("test", async (result, context, source) => {
            expect(result).toEqual({ doc: { foo: [456] }, docChanged: true });
            expect(isWebpackContext(context)).toBeTruthy();
            expect(source).toBe(
                await readPathAsString("data/references/b.json")
            );
            return ' {"foo": [456]} ';
        });
    }

    const stats = await compiler({
        entry: "./data/references/b",
        module: {
            rules: [
                {
                    test: /\.json$/,
                    use: [
                        {
                            loader: "../src/loaders/json-dependencies-loader.ts",
                            options: { plugins: [plugin] },
                        },
                    ],
                },
            ],
        },
    });

    // Specific formatting from hooks.dump is preserved
    expect(getModuleSource("./data/references/b.json", stats)).toBe(
        ' {"foo": [456]} '
    );
    expect.assertions(24);
});
