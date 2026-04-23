This folder is intended to hold pre-downloaded vocabulary embedding model files used by the semantic calibrator.

If you want to enable semantic vocabulary scoring, place the embedding model files here and set `VOCAB_EMBEDDINGS_PATH` in the backend `.env` (it already defaults to `./data/vocab-embeddings`).

Examples:
- Put a Xenova model checkout, or serialized embeddings files, under this folder.
- If you don't want embeddings, leave this folder empty or unset `VOCAB_EMBEDDINGS_PATH`.

This placeholder README prevents 'No embedding model found' warnings during startup when the env var is set but no files exist.