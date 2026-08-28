/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GNS3_SERVER_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
