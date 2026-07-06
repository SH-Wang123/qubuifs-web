# QubuiFS-Web

OpenAPI contract snapshot for the QubuiFS management API.

## Contents

- `openapi/openapi.yaml`: bundled OpenAPI 3.0 document for direct client or UI generation.
- `openapi/paths/`: active path fragments from the QubuiFS management API source tree.
- `openapi/schemas/`: schema fragments used by the path definitions.
- `docs/design.md`: Web console design draft, including endpoint handshake and container runtime.

## Status

The OpenAPI document is aligned with the current generated REST server interface and is usable as a frontend/client contract. Some backend management semantics are still incomplete in the QubuiFS service implementation, including node list/query/delete, node status, node device listing, readiness details, version build metadata, and QubuiFS topology node registration.
