/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Backend origin. Blank means "the same origin this console is served from". */
    readonly VITE_API_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
