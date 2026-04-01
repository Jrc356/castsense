# CastSense Acceptance Checklist (Web)

## Automated

- Web tests: make test
- Web typecheck: make typecheck
- Web lint: make lint
- Contracts generation: make contracts-generate-types

## Manual

- Capture flow: camera frame capture and file upload both produce analyzable images
- Analysis flow: successful run reaches Results and renders overlay zones when present
- Error flow: missing API key, denied location, and retry path all route through error screen
- Responsive layout: Home, Capture, Results, Settings, and Error screens usable on phone and desktop widths

## CI

CI workflow: .github/workflows/ci.yml

Required checks:
- backend
- web
- contracts
- docker
