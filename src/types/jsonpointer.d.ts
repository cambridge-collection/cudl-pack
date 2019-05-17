type Get = (obj: object, pointer: string) => object;
type Set = (obj: object, pointer: string, value: any) => any;

interface CompiledJSONPointer {
    get: Get;
    set: Set;
}

export const get: Get;
export const set: Set;
export function compile(obj: any, pointer: string): CompiledJSONPointer;
