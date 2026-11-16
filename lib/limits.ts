// Shared by the dropzone, the BFF, and FastAPI's MAX_BYTES.
// Vercel functions reject request bodies over 4.5 MB before our code runs, so stay under it.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
