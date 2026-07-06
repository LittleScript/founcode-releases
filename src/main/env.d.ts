declare module '*.md?raw' {
  const content: string
  export default content
}

// Injected at build time from package.json (electron.vite.config.ts).
declare const __APP_VERSION__: string
