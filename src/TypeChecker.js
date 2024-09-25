import { ts, Project } from 'ts-morph';

import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * @typedef {import('ts-morph').SourceFile} SourceFile
 * @typedef {import('ts-morph').Type} Type
 */

/**
 * @template T
 */
export class TypeChecker {
    static project = new Project({
        // useInMemoryFileSystem: true,
        skipAddingFilesFromTsConfig: true,
        compilerOptions: {
            outDir: 'dist',
            strict: true,
            noImplicitAny: true,
            strictFunctionTypes: true,
            strictPropertyInitialization: true,
            strictBindCallApply: true,
            noImplicitThis: true,
            noImplicitReturns: true,
            alwaysStrict: true,
            esModuleInterop: true,
            checkJs: true,
            allowJs: true,
            downlevelIteration: true,
            moduleResolution: ts.ModuleResolutionKind.NodeNext,
            target: ts.ScriptTarget.ESNext,
            module: ts.ModuleKind.NodeNext,
        },
    });
    
    static program = this.project.getProgram();
    static typeChecker = this.program.getTypeChecker();
    
    /**
     * @param {string} type
     * @param {string?} file
     */
    constructor (type, file = null) {
        const proj = TypeChecker.project;
        /** @type {SourceFile?} */
        let source = null;
        
        if (file)
            source = proj.getSourceFileOrThrow(file);
        
        this.check = TypeChecker.createChecker(source, type);
    }
    
    /**
     * @param {unknown} input
     */
    checkForWarn(input) {
        const result = this.check(input);
        
        if (result) {
            for (const warning of result) {
                console.warn(warning);
            }
        }
        
        return { warns: result, input: /** @type {T} */ (input) };
    }
    
    /**
     * @param {SourceFile} source
     * @param {string} strType
     */
    static findTypeFromSource(source, strType) {
        for (const t of source.getExportSymbols()) {
            if (t.getName() === strType) {
                return t.getDeclaredType();
            }
        }
        
        return;
    }
    
    /**
     * @param {SourceFile?} source
     * @param {string} strType
     */
    static findTypeFromProjectOrSource(source, strType) {
        /** @type {Type | undefined} */
        let type = undefined;
        
        if (source) {
            type = TypeChecker.findTypeFromSource(source, strType);
        } else {
            TypeChecker.typeChecker.resolveName(strType, undefined, ts.SymbolFlags.All, true)?.getDeclaredType();
            
            if (!type) {
                for (const sourceFile of TypeChecker.project.getSourceFiles()) {
                    type = TypeChecker.findTypeFromSource(sourceFile, strType);
                    
                    if (type)
                        break;
                }
            }
        }
        
        if (!type)
            throw new Error(`TypeChecker: type [${strType}] not found`);
        
        return type;
    }
    
    /**
     * @param {string} root
     * @param {string} val
     */
    static rootMerge(root, val, isUnion = false, isType = false) {
        const hardVal = isType ? `[${val}]` : val;
        return `${root}.${isUnion ? `{${hardVal}}` : hardVal}`;
    }
    
    /**
     * @typedef {string[] | undefined} ErrorTypes
     */
    
    /** @param {Type} type */
    static getShortName(type) {
        const name = type.getText();
        
        if (type.isAnonymous())
            return `ANONYMOUS: ${name}`;
        
        if (name.includes('import'))
            return name.match(/\.(.+?)$/)?.[1] ?? `[Not resolve type '${name}']`;
        
        return name;
    }
    
    /** @param {any} input */
    static isPrimitive(input) {
        return typeof input === 'string' || typeof input === 'number' || typeof input === 'bigint' || typeof input === 'boolean' || typeof input === 'undefined' || input === null;
    }
    
    /** @param {Type} type */
    static isPrimitiveType(type) {
        return type.isString() || type.isNumber() || type.isBigInt() || type.isBoolean() || type.isUndefined() || type.isNull() || type.isLiteral();
    }
    
    /** @param {string[]} stack */
    static isStack(stack) {
        return stack.length ? stack : undefined;
    }
    
    /**
     * @template {*} T
     * @param {T[]} a
     * @param {T[]} b
     */
    static Array_Difference(a, b) {
        const b_set = new Set(b);
        
        return a.filter(item => !b_set.has(item));
    }
    
    /**
     * @param {Type} type
     * @param {Map<Type, (input: unknown, root: string, errStack?: string[]) => ErrorTypes>} typeCheckMap
     * @returns {(input: unknown, root: string, errStack?: string[]) => ErrorTypes}
     */
    static createCheckerToType(type, typeCheckMap) {
        // console.log(root);
        
        const check = typeCheckMap.get(type);
        const dumpCheck = (/** @type {Parameters<ReturnType<typeof TypeChecker['createCheckerToType']>>} */ ...args) => {
            const check = typeCheckMap.get(type);
            
            // console.log([...typeCheckMap.map.entries()].map(([k, v]) => {
            //     return {
            //         key: k.getText(),
            //         value: [...v.entries()].map(([k, v]) => `${k}: ${v.name ?? '[Internal]'}`),
            //     }
            // }));
            // console.log(type.getText());
            
            if (!check)
                throw new Error(`TypeChecker runtime: for type [${TypeChecker.getShortName(type)}] not generate check function`);
            
            const result = check(...args);
            
            if (result)
                return result;
        };
        
        if (check) {
            return check;
        } else {
            typeCheckMap.set(type, dumpCheck);
        }
        
        /**
         * @param {(input: unknown, literal: any) => boolean} predicate
         * @param {string} nameTypeExpect
         * @returns {ReturnType<TypeChecker.createCheckerToType>}
         */
        function fabricCheck(predicate, nameTypeExpect) {
            const literal = type.getLiteralValue();
            const expect = type.isLiteral() ? `(${nameTypeExpect}) ${literal}` : nameTypeExpect;
            
            return (input, root) => {
                if (predicate(input, literal))
                    return [`${root}: Is not '${expect}', comes '(${typeof input}) ${input}'`];
            }
        }
        
        switch (true) {
            case type.isNull():      return fabricCheck((input) => input !== null,             'null');
            case type.isUndefined(): return fabricCheck((input) => input !== undefined,        'undefined');
            case type.isString():    return fabricCheck((input) => typeof input !== 'string',  'string');
            case type.isNumber():    return fabricCheck((input) => typeof input !== 'number',  'number');
            case type.isBoolean():   return fabricCheck((input) => typeof input !== 'boolean', 'boolean');
            
            case type.isStringLiteral():  return fabricCheck((input, literal) => typeof input !== 'string'  || input !== literal, 'string');
            case type.isNumberLiteral():  return fabricCheck((input, literal) => typeof input !== 'number'  || input !== literal, 'number');
            case type.isBooleanLiteral(): return fabricCheck((input, literal) => typeof input !== 'boolean' || input !== literal, 'boolean');
            
            case type.isArray(): {
                const t = type.getTypeArguments()[0];
                const check = TypeChecker.createCheckerToType(t, typeCheckMap);
                
                typeCheckMap.set(t, check);
                
                return (input, root, errStack = []) => {
                    if (!Array.isArray(input))
                        return [`${root}: Is not 'Array', comes type '${typeof input}'`];
                    
                    for (const [key, item] of input.entries()) {
                        const err = check(item, TypeChecker.rootMerge(root, '[]'));
                        
                        if (err !== undefined) {
                            for (const e of err) { // HACK: Главное не менять в этом case аргументы для создания check, тогда наверное ничего не сломается )
                                const p1 = e.slice(0, root.length + 2);
                                const p2 = e.slice(root.length + 2);
                                
                                errStack.push(`${p1}${key}${p2}`);
                            }
                            
                            // errStack.push(...err);
                        }
                    }
                    
                    return TypeChecker.isStack(errStack);
                }
            }
            
            case type.isIntersection():
            case type.isUnion(): {
                /** @type {Map<Type, [ReturnType<TypeChecker.createCheckerToType>, boolean, string, boolean]>} */
                const types = new Map();
                
                /** @param {Type} type */
                function getName(type) {
                    return type.isObject() ? TypeChecker.getShortName(type) : type.getText();
                }
                
                /** @type {Type[]} */
                const ts = [];
                
                if (type.isUnion()) {
                    ts.push(...type.getUnionTypes());
                } else {
                    const iType = /** @type {Type} */ (type);
                    ts.push(...iType.getIntersectionTypes());
                }
                
                for (const t of ts) {
                    const name = getName(t);
                    const check = TypeChecker.createCheckerToType(t, typeCheckMap);
                    
                    types.set(t, [check, TypeChecker.isPrimitiveType(t), name, t.isObject()]);
                    typeCheckMap.set(t, check);
                    
                    // debugger;
                }
                
                const UoIname = [...types.keys()].map(getName).join(' | ');
                // const types_count = [...types].length;
                
                return (input, root, errStack = []) => {
                    for (const [check, isPrimitive, name, isObject] of types.values()) {
                        const err = check(input, TypeChecker.rootMerge(root, name, true, isObject));
                        
                        if (err === undefined)
                            return;
                        
                        if (!isPrimitive)
                            errStack.push(...err);
                    }
                    
                    if (TypeChecker.isPrimitive(input))
                        return [`${root}: Is not (${UoIname}), comes '(${typeof input}) ${input}'`];
                    
                    return TypeChecker.isStack(errStack);
                }
            }
            
            case type.isObject(): {
                /** @type {Map<string, ReturnType<TypeChecker.createCheckerToType>>} */
                const props = new Map();
                
                for (const prop of type.getProperties()) {
                    const propName = prop.getName();
                    const decls = prop.getDeclarations();
                    
                    if (decls.length > 1)
                        throw new Error(`TypeChecker: property [${type.getText()}.${propName}] has ${decls.length} declarations, only one expected`);
                    
                    const t = decls[0].getType();
                    const check = TypeChecker.createCheckerToType(t, typeCheckMap);
                    
                    props.set(propName, check);
                    typeCheckMap.set(t, check);
                }
                
                const name = TypeChecker.getShortName(type);
                
                return (input, root, errStack = []) => {
                    if (!(input instanceof Object))
                        return [`${root}: Is not 'Object' (${name}), comes '(${typeof input}) ${input}'`];
                    
                    for (const [prop, check] of props) {
                        const err = check(/** @type {Record<string, unknown>} */(input)[prop], TypeChecker.rootMerge(root, prop));
                        
                        if (err !== undefined) {
                            errStack.push(...err);
                        }
                    }
                    
                    for (const prop of TypeChecker.Array_Difference(Object.keys(input), [...props.keys()])) {
                        errStack.push(`${root}.${prop}: Should not be defined`);
                    }
                    
                    return TypeChecker.isStack(errStack);
                };
            }
            
            default:
                for (const prop of Object.getOwnPropertyNames(Object.getPrototypeOf(type))) {
                    if (/^is.+$/.test(prop) && prop != 'isAssignableTo') {
                        console.log(prop, /** @type {Record<string, any>} */ (type)[prop].apply(type));
                    }
                }
                
                throw new Error(`TypeChecker: type [${type.getText()}] is not fabric`);
        }
    }
    
    /**
     * @param {SourceFile?} source
     * @param {string} strType
     */
    static createChecker(source, strType) {
        const typeCheckMap = new Map();
        const type = TypeChecker.findTypeFromProjectOrSource(source, strType);
        const root = `[${TypeChecker.getShortName(type)}]`;
        const check = TypeChecker.createCheckerToType(type, typeCheckMap);
        
        typeCheckMap.set(type, check);
        
        return (/** @type {unknown} */ input) => {
            try {
                return check(input, root);
            } catch (err) {
                console.log(err);
                
                if (err instanceof Error)
                    return [err.message];
                
                if (typeof err === 'string')
                    return [err];
                
                throw err;
            }
        };
    }
}

const mainFile = path.join(__dirname, './main.js');

TypeChecker.project.addSourceFileAtPath(mainFile);
TypeChecker.project.resolveSourceFileDependencies();

if (false) {
    console.log('TypeChecker, PreEmitDiagnostics:', mainFile);
    TypeChecker.project.getPreEmitDiagnostics().map(d =>
        console.log(TypeChecker.project.formatDiagnosticsWithColorAndContext([d]))
    );
}