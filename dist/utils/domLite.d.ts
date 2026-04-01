export declare class Selection {
    private nodes;
    private root;
    constructor(nodes: any[] | undefined, root: any);
    get length(): number;
    first(): Selection;
    each(cb: (index: number, node: any) => void): void;
    attr(name: string): string | undefined;
    prop(name: string): any;
    text(): string;
    find(selector: string): Selection;
    children(): Selection;
    closest(selector: string): Selection;
    remove(): void;
    clone(): Selection;
}
export type DollarFunction = ((selector: string | any | any[]) => Selection) & {
    root: any;
};
export declare function load(html: string): DollarFunction;
//# sourceMappingURL=domLite.d.ts.map