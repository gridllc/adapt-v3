export type UploadPhase =
  | 'idle'
  | 'validating'
  | 'uploading'        // has numeric % progress
  | 'finalizing'       // 95–100%, switch UI to "Preparing processing…"
  | 'processing'       // indeterminate spinner, show moduleId if known
  | 'ready'
  | 'error';
