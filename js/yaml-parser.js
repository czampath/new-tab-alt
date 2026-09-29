// ============================================================
//  Local YAML Parser - supported config-oriented YAML subset
// ============================================================

window.YamlParser = (() => {
    class YamlError extends Error {
        constructor(message, line) {
            super(`${message}${line ? ` at line ${line}` : ''}`);
        }
    }

    function indentOf(raw, line) {
        if (/^\t/.test(raw)) throw new YamlError('Tabs cannot be used for indentation', line);
        return raw.length - raw.trimStart().length;
    }

    function uncomment(text) {
        let quote = '';
        let escaped = false;
        let depth = 0;
        for (let index = 0; index < text.length; index++) {
            const char = text[index];
            if (quote) {
                if (char === quote && !escaped) quote = '';
                escaped = char === '\\' && !escaped;
                continue;
            }
            if (char === '"' || char === "'") quote = char;
            else if (char === '[' || char === '{') depth++;
            else if (char === ']' || char === '}') depth--;
            else if (char === '#' && depth === 0 && (index === 0 || /\s/.test(text[index - 1]))) return text.slice(0, index).trimEnd();
        }
        return text.trimEnd();
    }

    function splitTopLevel(text, separator) {
        const parts = [];
        let start = 0;
        let quote = '';
        let escaped = false;
        let depth = 0;
        for (let index = 0; index < text.length; index++) {
            const char = text[index];
            if (quote) {
                if (char === quote && !escaped) quote = '';
                escaped = char === '\\' && !escaped;
                continue;
            }
            if (char === '"' || char === "'") quote = char;
            else if (char === '[' || char === '{') depth++;
            else if (char === ']' || char === '}') depth--;
            else if (char === separator && depth === 0) {
                parts.push(text.slice(start, index).trim());
                start = index + 1;
            }
        }
        parts.push(text.slice(start).trim());
        return parts;
    }

    function keyValueIndex(text) {
        let quote = '';
        let escaped = false;
        let depth = 0;
        for (let index = 0; index < text.length; index++) {
            const char = text[index];
            if (quote) {
                if (char === quote && !escaped) quote = '';
                escaped = char === '\\' && !escaped;
                continue;
            }
            if (char === '"' || char === "'") quote = char;
            else if (char === '[' || char === '{') depth++;
            else if (char === ']' || char === '}') depth--;
            else if (char === ':' && depth === 0 && (index === text.length - 1 || /\s|[\[{]/.test(text[index + 1]))) return index;
        }
        return -1;
    }

    function parseQuoted(value, line) {
        if (value[0] === "'") {
            if (!value.endsWith("'")) throw new YamlError('Unterminated quoted string', line);
            return value.slice(1, -1).replace(/''/g, "'");
        }
        try { return JSON.parse(value); } catch { throw new YamlError('Invalid double-quoted string', line); }
    }

    function parseFlow(value, line) {
        const inner = value.slice(1, -1).trim();
        if (!inner) return value[0] === '[' ? [] : {};
        if (value[0] === '[') return splitTopLevel(inner, ',').map((item) => parseScalar(item, line));
        const object = {};
        splitTopLevel(inner, ',').forEach((entry) => {
            const separator = keyValueIndex(entry);
            if (separator < 0) throw new YamlError('Invalid flow mapping', line);
            const key = parseKey(entry.slice(0, separator).trim(), line);
            if (Object.hasOwn(object, key)) throw new YamlError(`Duplicate key "${key}"`, line);
            object[key] = parseScalar(entry.slice(separator + 1).trim(), line);
        });
        return object;
    }

    function parseScalar(value, line) {
        const text = value.trim();
        if (!text) return null;
        if (/^[&*!]/.test(text) || text.startsWith('<<:')) throw new YamlError('Anchors, aliases, tags, and merge keys are not supported', line);
        if (text[0] === '"' || text[0] === "'") return parseQuoted(text, line);
        if ((text[0] === '[' && text.endsWith(']')) || (text[0] === '{' && text.endsWith('}'))) return parseFlow(text, line);
        if (text === 'null' || text === '~') return null;
        if (text === 'true') return true;
        if (text === 'false') return false;
        if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(text)) return Number(text);
        return text;
    }

    function parseKey(value, line) {
        const key = parseScalar(value, line);
        if (key === null || typeof key === 'object') throw new YamlError('Mapping keys must be strings or numbers', line);
        return String(key);
    }

    class Parser {
        constructor(source) {
            this.lines = source.replace(/\r\n?/g, '\n').split('\n').map((raw, index) => ({ raw, line: index + 1 }));
            this.index = 0;
        }

        current(skipEmpty = true) {
            while (this.index < this.lines.length) {
                const item = this.lines[this.index];
                const content = uncomment(item.raw.slice(indentOf(item.raw, item.line)));
                if (!skipEmpty || content) return { ...item, indent: indentOf(item.raw, item.line), content };
                this.index++;
            }
            return null;
        }

        parse() {
            const current = this.current();
            if (!current) return null;
            return this.parseNode(current.indent);
        }

        parseNode(indent) {
            const current = this.current();
            if (!current || current.indent < indent) return null;
            if (current.indent !== indent) throw new YamlError('Unexpected indentation', current.line);
            return current.content === '-' || current.content.startsWith('- ') ? this.parseSequence(indent) : this.parseMap(indent);
        }

        parseMap(indent, seed = {}) {
            const object = seed;
            while (true) {
                const current = this.current();
                if (!current || current.indent < indent) break;
                if (current.indent > indent) throw new YamlError('Unexpected indentation', current.line);
                if (current.content === '-' || current.content.startsWith('- ')) break;
                const separator = keyValueIndex(current.content);
                if (separator < 0) throw new YamlError('Expected a mapping key', current.line);
                const key = parseKey(current.content.slice(0, separator).trim(), current.line);
                if (Object.hasOwn(object, key)) throw new YamlError(`Duplicate key "${key}"`, current.line);
                const value = current.content.slice(separator + 1).trim();
                this.index++;
                object[key] = this.parseValue(value, indent, current.line);
            }
            return object;
        }

        parseSequence(indent) {
            const array = [];
            while (true) {
                const current = this.current();
                if (!current || current.indent < indent) break;
                if (current.indent > indent) throw new YamlError('Unexpected indentation', current.line);
                if (!(current.content === '-' || current.content.startsWith('- '))) break;
                const value = current.content.slice(1).trim();
                this.index++;
                const separator = keyValueIndex(value);
                if (separator >= 0) {
                    const key = parseKey(value.slice(0, separator).trim(), current.line);
                    const object = {};
                    object[key] = this.parseValue(value.slice(separator + 1).trim(), indent, current.line);
                    const next = this.current();
                    if (next && next.indent > indent) this.parseMap(next.indent, object);
                    array.push(object);
                } else {
                    array.push(this.parseValue(value, indent, current.line));
                }
            }
            return array;
        }

        parseValue(value, parentIndent, line) {
            if (value === '|' || value === '>') return this.parseBlockString(parentIndent, value === '>');
            if (value) return parseScalar(value, line);
            const next = this.current();
            return next && next.indent > parentIndent ? this.parseNode(next.indent) : null;
        }

        parseBlockString(parentIndent, folded) {
            const collected = [];
            let contentIndent = null;
            while (this.index < this.lines.length) {
                const item = this.lines[this.index];
                if (!item.raw.trim()) {
                    collected.push('');
                    this.index++;
                    continue;
                }
                const indent = indentOf(item.raw, item.line);
                if (indent <= parentIndent) break;
                if (contentIndent === null) contentIndent = indent;
                collected.push(item.raw.slice(contentIndent));
                this.index++;
            }
            const text = collected.join('\n').replace(/\n+$/, '');
            return folded ? text.replace(/([^\n])\n([^\n])/g, '$1 $2') : text;
        }
    }

    function loadAll(source) {
        const documents = [];
        const parts = String(source).replace(/^%.*$/gm, '').split(/^---\s*(?:#.*)?$/m);
        for (const part of parts) {
            const content = part.replace(/^\.\.\.\s*(?:#.*)?$/m, '');
            if (content.trim()) documents.push(new Parser(content).parse());
        }
        return documents;
    }

    function scalar(value) {
        if (value === null) return 'null';
        if (typeof value === 'boolean' || typeof value === 'number') return String(value);
        const text = String(value);
        return text && !/^(?:null|~|true|false|-?(?:0|[1-9]\d*)(?:\.\d+)?)$/i.test(text) && /^[A-Za-z0-9_./:@+%=-]+(?: [A-Za-z0-9_./:@+%=-]+)*$/.test(text)
            ? text : JSON.stringify(text);
    }

    function dump(value, level = 0) {
        const pad = '  '.repeat(level);
        if (!value || typeof value !== 'object') return scalar(value);
        if (Array.isArray(value)) {
            if (!value.length) return '[]';
            return value.map((item) => {
                if (!item || typeof item !== 'object') return `${pad}- ${scalar(item)}`;
                return `${pad}-\n${dump(item, level + 1)}`;
            }).join('\n');
        }
        const keys = Object.keys(value);
        if (!keys.length) return '{}';
        return keys.map((key) => {
            const item = value[key];
            const outputKey = scalar(key);
            if (!item || typeof item !== 'object') return `${pad}${outputKey}: ${scalar(item)}`;
            return `${pad}${outputKey}:\n${dump(item, level + 1)}`;
        }).join('\n');
    }

    return { loadAll, dump, YamlError };
})();