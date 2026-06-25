# Proto Rig API Specifications

This directory contains vendored API specifications for the Proto miner devices. These files are extracted from the private `miner-firmware` repository to enable open-source development of the fleet management system.

## Directory Structure

```
proto-rig-api/
├── grpc/           # Vendored gRPC + hashboard .proto files (NATS protobuf codegen + reference)
├── openapi/        # OpenAPI specification for REST API
│   └── MDK-API.json
├── VERSION.md      # Version tracking (single source of truth)
└── README.md       # This file
```

Two code-generation paths consume this directory:

- The OpenAPI spec drives the ProtoOS REST client and the simulator (see
  below).
- The `grpc/` proto files drive protobuf-es generation for binary NATS message
  decoding in the ProtoOS dashboard. They remain a faithful vendored copy of
  the on-rig surface, so they also serve as reference documentation for the
  parts not yet consumed.

## Usage

### OpenAPI Specification

Used by:
1. **Client** - To generate TypeScript types for the ProtoOS dashboard
2. **Simulator** - As reference for the fake-proto-rig REST API implementation
3. **Plugin** - As reference for the proto plugin REST client

```bash
# Generate TypeScript client
cd client && npm run generate-api-types
```

The generated code is placed in `client/src/protoOS/api/generatedApi.ts`.

The simulator (`server/fake-proto-rig/`) manually implements these endpoints - see its README for maintenance guidelines.

### gRPC / hashboard Protos

Used by:
1. **Client** - To generate protobuf-es schemas (`protoc-gen-es`) for decoding
   binary NATS messages in the ProtoOS dashboard (consumed under
   `client/src/protoOS/nats/`)

```bash
# Generate protobuf-es schemas (part of `just gen`)
just gen
```

The generated code is placed in `client/src/protoOS/api/generated/nats/`,
configured by `proto-rig-api/grpc/buf.gen.yaml`. Generation covers every proto
in the module; schemas that aren't imported are tree-shaken from the app
bundle, so the full surface is generated even though only a subset is wired up
today.

## Versioning

The `VERSION.md` file in this directory contains:
- Source repository and commit SHA
- Extraction date
- Update instructions

## Updating

When the miner API changes:

1. Re-vendor the gRPC/hashboard proto files and the OpenAPI specification from
   miner-firmware (see `VERSION.md` for the exact source paths and steps)
2. Update `VERSION.md` with the new commit SHA(s) and dates
3. Regenerate dependent code:
   - `cd client && npm run generate-api-types` (TypeScript types from the OpenAPI spec)
   - `just gen` (protobuf-es schemas from the gRPC protos → `client/src/protoOS/api/generated/nats/`)
4. Update the simulator REST API if the OpenAPI spec changed:
   - See `server/fake-proto-rig/README.md` for maintenance checklist
5. Run tests to verify compatibility
6. Commit all changes together
