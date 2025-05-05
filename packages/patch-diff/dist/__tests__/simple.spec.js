"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const patch_diff_1 = __importDefault(require("../src/patch-diff"));
const data = {
    a: {
        b: {
            c: {
                d: {
                    e: 'f',
                    g: 'h',
                    inner: {
                        a: {
                            b: {
                                c: {
                                    d: {
                                        e: 'f',
                                        inner: {
                                            a: {
                                                b: {
                                                    c: {
                                                        d: {
                                                            e: 'f',
                                                            inner: {
                                                                a: {
                                                                    b: {
                                                                        c: {
                                                                            d: {
                                                                                e: 'f',
                                                                                inner: {
                                                                                    a: {
                                                                                        b: {
                                                                                            c: {
                                                                                                d: {
                                                                                                    e: 'f',
                                                                                                    g: 'h'
                                                                                                }
                                                                                            },
                                                                                            c2: false
                                                                                        }
                                                                                    }
                                                                                }
                                                                            }
                                                                        },
                                                                        c2: false
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    },
                                                    c2: false
                                                }
                                            }
                                        }
                                    }
                                },
                                c2: false
                            }
                        }
                    }
                }
            },
            c2: false
        }
    }
};
const deepPatch = {
    ...structuredClone(data),
    a: {
        b: {
            c: {
                d: {
                    e: 'patch',
                    g: structuredClone(data),
                    f: structuredClone(data),
                    h: {
                        a: {
                            b: {
                                c: {
                                    d: {
                                        e: 'patch',
                                        g: structuredClone(data)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};
// @ts-expect-error
deepPatch.a.b.c2 = structuredClone(deepPatch);
// @ts-expect-error
deepPatch.a.b.c3 = structuredClone(deepPatch);
// @ts-expect-error
deepPatch.a.b.c4 = structuredClone(deepPatch);
// @ts-expect-error
deepPatch.a.b.c5 = structuredClone(deepPatch);
// @ts-expect-error
deepPatch.a.b.c6 = structuredClone(deepPatch);
// @ts-expect-error
deepPatch.a.b.c7 = structuredClone(deepPatch);
describe('PatchDiff simple usage', () => {
    it('should perform PatchDiff operations without error', () => {
        let pd = new patch_diff_1.default(structuredClone(deepPatch));
        //console.log(JSON.stringify(pd.get()));
        pd.subscribe('', () => { });
        pd.subscribe('a', () => { });
        pd.subscribe('a', (diff) => { });
        pd.subscribe('a.b', () => { });
        pd.subscribe('a.b.c', () => { });
        pd.subscribe('a.b.c.d.inner.a.b.c.d.inner.a.b.c.d', (diff) => console.log('sub a.b.c.d.inner.a.b.c.d.inner.a.b.c.d =>', JSON.stringify(diff)));
        console.info('======== mutating data ========');
        console.time('displace');
        pd.at('a.b').displace(pd.options.deleteKeyword);
        console.timeEnd('displace');
        //console.log(JSON.stringify(pd.get()));
        console.warn("======= remove =======");
        pd = new patch_diff_1.default(structuredClone(deepPatch));
        //console.log(JSON.stringify(pd.get()));
        pd.subscribe('', () => { });
        pd.subscribe('a', () => { });
        pd.subscribe('a', (diff) => { });
        pd.subscribe('a.b', () => { });
        pd.subscribe('a.b.c', () => { });
        pd.subscribe('a.b.c.d.inner.a.b.c.d.inner.a.b.c.d', (diff) => console.log('sub a.b.c.d.inner.a.b.c.d.inner.a.b.c.d =>', JSON.stringify(diff)));
        console.info('======== mutating data ========');
        console.time('remove');
        pd.at('a.b').remove();
        console.timeEnd('remove');
        //console.log(JSON.stringify(pd.get()));
        console.info('======== test apply ========');
        for (let i = 0; i < 10; i++) {
            const pdPerf = new patch_diff_1.default(structuredClone(data));
            console.time(`apply ${i}`);
            pdPerf.apply(deepPatch);
            console.timeEnd(`apply ${i}`);
        }
    });
});
//# sourceMappingURL=simple.spec.js.map