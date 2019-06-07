declare class BiMap<T> {
    constructor();

    public set(key: T, value: T): void;
    public get(key: T): T | undefined;
    public getInverse(value: T): T | undefined;
    public has(key: T): boolean;
    public keys(key: T): IterableIterator<T>;
    public values(key: T): IterableIterator<T>;
}

export declare class CurieUtil {
    constructor(mapping: BiMap<string>);

    public getPrefixes(): IterableIterator<string>;
    public getExpansion(curiePrefix: string): string | undefined;
    public getCurie(iri: string): string | null;
    public getIri(curie: string): string | null;
    public getCurieMap(): BiMap<string>;
}

interface Context {
    [key: string]: string;
}

export declare function parseContext(jsonObject: {'@context': Context}): BiMap<string>;
