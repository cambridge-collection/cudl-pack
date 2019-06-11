const identifiedID = Symbol('Identified<T> id property');
export function identify<T>(obj: {[key: string]: T}): Array<Identified<T>> {
    return Object.keys(obj).map(key => ({[identify.id]: key, ...obj[key]}));
}
identify.id = identifiedID;

export type Identified<T> = { [identify.id]: string } & { [K in keyof T]: T[K] };
