# CastSense PRD (Web)

CastSense is a responsive web application that analyzes fishing-scene images and returns overlay-ready cast-zone recommendations.

## Product Scope

- Input: user-captured or uploaded photo
- Context: optional location, mode, platform, gear, and notes
- Output: likely species, cast zones, arrows, retrieve paths, and tactics

## Architecture Summary

- Frontend: web/ (React + TypeScript + Vite)
- Contracts: contracts/ JSON Schemas
- Optional backend hardening (future): proxy API keys and AI requests

## Current Security Model

- Migration parity mode stores BYO API key in browser localStorage.
- Production hardening requirement: move key handling to backend session/proxy.
