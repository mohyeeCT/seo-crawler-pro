// Minimal DOM wrapper around htmlparser2 + css-select to replace Cheerio for our use cases
import { parseDocument } from 'htmlparser2';
import { selectAll, is as matches } from 'css-select';
import { getAttributeValue, getChildren, getName, getText, removeElement } from 'domutils';
function isElement(node) {
    return !!node && node.type === 'tag';
}
function isParent(node) {
    return !!node && Array.isArray(node.children);
}
function deepClone(node) {
    // Shallow copy
    const copy = Array.isArray(node) ? [] : { ...node };
    if (isParent(node)) {
        copy.children = node.children.map((c) => {
            const childClone = deepClone(c);
            childClone.parent = copy;
            return childClone;
        });
    }
    return copy;
}
export class Selection {
    constructor(nodes = [], root) {
        this.nodes = nodes;
        this.root = root;
    }
    get length() {
        return this.nodes.length;
    }
    first() {
        return new Selection(this.nodes.length ? [this.nodes[0]] : [], this.root);
    }
    each(cb) {
        this.nodes.forEach((n, i) => cb(i, n));
    }
    attr(name) {
        const node = this.nodes[0];
        if (!isElement(node))
            return undefined;
        const v = getAttributeValue(node, name);
        return v === null ? undefined : v;
    }
    prop(name) {
        const node = this.nodes[0];
        if (!node)
            return undefined;
        if (name === 'tagName') {
            return isElement(node) ? getName(node).toUpperCase() : undefined;
        }
        return undefined;
    }
    text() {
        return this.nodes.map(n => getText(n)).join('');
    }
    find(selector) {
        const found = [];
        this.nodes.forEach(n => {
            const sel = selectAll(selector, n);
            found.push(...sel);
        });
        return new Selection(found, this.root);
    }
    children() {
        const kids = [];
        this.nodes.forEach(n => {
            if (isParent(n)) {
                for (const c of getChildren(n) || []) {
                    if (isElement(c))
                        kids.push(c);
                }
            }
        });
        return new Selection(kids, this.root);
    }
    closest(selector) {
        const results = [];
        this.nodes.forEach(n => {
            let cur = n;
            while (cur && cur.type !== 'root') {
                if (isElement(cur) && matches(cur, selector)) {
                    results.push(cur);
                    break;
                }
                cur = cur.parent;
            }
        });
        return new Selection(results, this.root);
    }
    remove() {
        this.nodes.forEach(n => removeElement(n));
    }
    clone() {
        const clones = this.nodes.map(n => deepClone(n));
        return new Selection(clones, this.root);
    }
}
export function load(html) {
    const doc = parseDocument(html);
    const $ = ((selector) => {
        if (typeof selector === 'string') {
            const nodes = selectAll(selector, doc);
            return new Selection(nodes, doc);
        }
        else if (Array.isArray(selector)) {
            return new Selection(selector, doc);
        }
        else if (selector && typeof selector === 'object') {
            return new Selection([selector], doc);
        }
        return new Selection([], doc);
    });
    $.root = doc;
    return $;
}
//# sourceMappingURL=domLite.js.map