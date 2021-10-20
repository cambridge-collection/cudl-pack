const identifiedID = Symbol("Identified<T> id property");
export function identify<T>(obj: { [key: string]: T }): Array<Identified<T>> {
    return Object.keys(obj).map((key) => ({ [identify.id]: key, ...obj[key] }));
}
identify.id = identifiedID;

function index<T>(identified: Array<Identified<T>>): { [key: string]: T } {
    const result: { [key: string]: T } = {};
    for (const i of identified) {
        const stripped: MaybeIdentified<T> = { ...i };
        delete stripped[identify.id];
        const key = i[identify.id];
        result[key] = stripped;
    }
    return result;
}
identify.index = index;

export type Identified<T> = { [identifiedID]: string } & {
    [K in keyof T]: T[K];
};
type MaybeIdentified<T> = { [identifiedID]?: string } & {
    [K in keyof T]: T[K];
};
