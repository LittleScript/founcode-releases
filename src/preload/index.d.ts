import type { FouncodeApi } from '../shared/ipc-contract'

declare global {
  interface Window {
    founcode: FouncodeApi
  }
}
