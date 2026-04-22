# RuView (WiFi-DensePose) — Complete Knowledge Base

**Last Updated:** April 20, 2026  
**Repository:** https://github.com/ruvnet/RuView  
**License:** MIT OR Apache-2.0

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Core Concepts & Architecture](#core-concepts--architecture)
3. [Hardware Setup & Firmware](#hardware-setup--firmware)
4. [Software Pipelines](#software-pipelines)
5. [API Reference](#api-reference)
6. [Edge Intelligence Modules](#edge-intelligence-modules)
7. [Configuration & Deployment](#configuration--deployment)
8. [Cognitum Seed Integration](#cognitum-seed-integration)
9. [Troubleshooting & Known Issues](#troubleshooting--known-issues)
10. [Architecture Decision Records (ADRs)](#architecture-decision-records)
11. [Domain-Driven Design Models](#domain-driven-design-models)
12. [Training & Model Management](#training--model-management)

---

## Executive Summary

### What is RuView?

RuView is an open-source WiFi sensing platform that transforms ordinary Channel State Information (CSI) from commodity WiFi hardware (ESP32-S3 microcontrollers) into real-time human sensing capabilities **without cameras or wearables**. Physics-based, privacy-first, runs entirely on-edge hardware.

**Core Capabilities:**
- **Presence detection & occupancy counting** through walls and obstacles
- **Vital signs monitoring** — breathing (6-30 BPM), heart rate (40-120 BPM)
- **Activity recognition** — walking, sitting, gestures, falls
- **Body pose estimation** — 17 COCO keypoints with 92.9% PCK@20 accuracy
- **Sleep monitoring** with apnea screening
- **Multi-person detection** and separation

**Key Differentiators:**
- Runs entirely on edge (ESP32-S3, ~$9 per node) — no cloud required
- Cryptographic witness chains attest to measurement integrity
- Sub-30-second self-learning with spiking neural networks
- 810x speedup vs. Python (Rust implementation)
- 60+ specialized WASM modules for medical, security, retail, industrial use cases
- MIT/Apache-2.0 open source with 1,031+ passing Rust unit tests

### Minimum Hardware

| Item | Qty | Cost | Notes |
|------|-----|------|-------|
| ESP32-S3 microcontroller | 2+ | ~$9 each | Must be S3 variant (dual-core, 240 MHz) |
| WiFi router (existing) | 1 | $0 | Acts as RF illuminator |
| Cognitum Seed (optional) | 1 | ~$131 | For persistent memory & vector storage |
| **Total** | | **~$27-150** | Starter kit to production-scale |

---

## Core Concepts & Architecture

### How It Works

1. **Signal Path**: WiFi router transmits radio waves → waves bounce off human body → ESP32 receiver captures disturbance as CSI
2. **Processing Pipeline**: Raw CSI → Phase unwrapping → Feature extraction → Neural inference → Pose/vitals/presence
3. **On-Device Execution**: All processing runs on the ESP32 (Tier 0-2) or via WASM modules (Tier 3). No internet required.
4. **Distributed Sensing**: Multiple nodes (3-6) form a mesh using Time-Division Multiplexing (TDM) for multi-node coherence and pose resolution

### Signal Processing Pipeline

```
WiFi Router (Transmitter)
        ↓
     Radio Waves
        ↓
   Human Body (Scatterer)
        ↓
   ESP32-S3 (Receiver)
        │
        ├─→ Tier 0: Raw CSI Passthrough (20 Hz, ADR-018 format)
        │
        ├─→ Tier 1: Signal Conditioning
        │   - Phase unwrapping (removes 2π discontinuities)
        │   - Welford running variance per subcarrier
        │   - Top-K subcarrier selection (64→35 for bandwidth)
        │   - Delta compression (XOR + RLE, 70% reduction)
        │
        ├─→ Tier 2: Full Feature Extraction
        │   - Bandpass filtering (vital sign bands)
        │   - Zero-crossing BPM (breathing 0.1-0.5 Hz, heart rate 0.8-2 Hz)
        │   - Phase variance (presence detection)
        │   - Fall acceleration thresholds
        │   - Person counting via subcarrier clustering
        │   - 8-dim feature vector (presence, motion, BR, HR, variance, persons, fall, RSSI)
        │
        └─→ Tier 3: WASM Programmable Sensing
            - Load hot-swappable modules (RVF containers)
            - Execute custom logic (<10ms budget)
            - Emit domain-specific events (medical, security, retail)
```

### CSI Fundamentals

**Channel State Information (CSI)** describes how a WiFi signal's amplitude and phase change as it travels through the environment.

- **Subcarriers**: 802.11n/ac WiFi uses 52-64 subcarriers (different frequency bins within a 20/40/80 MHz channel)
- **I/Q Sampling**: Each subcarrier is represented as a complex number (I=in-phase, Q=quadrature)
- **Sampling Rate**: 20-28 Hz per channel on ESP32 (governed by WiFi driver)
- **Resolution**: ~3cm wavelength at 2.4 GHz → body motion causes measurable phase shifts
- **Multi-antenna**: 1 TX × N RX (MISO) or N TX × N RX (MIMO) configurations provide spatial diversity

**Why humans are detectable:**
- Human body is ~60% water → high dielectric constant → strong scatterer
- Breathing causes ~mm-level chest wall motion → measurable phase change (0.1-0.5 Hz)
- Heartbeat causes ~mm blood volume change → measurable phase oscillation (0.8-2 Hz)
- Walking/gestures cause larger (cm-level) displacements → easy to detect

### Domain-Driven Design

RuView uses DDD to organize code into **bounded contexts** — autonomous domains with precise language and clear boundaries:

**Key Bounded Contexts:**
1. **Sensing Context** — CSI capture, phase unwrapping, subcarrier selection
2. **Vital Signs Context** — Breathing/HR detection via bandpass + autocorrelation
3. **Pose Context** — 17-keypoint body skeleton estimation (WiFlow neural network)
4. **Coherence Context** — Multi-node fusion via time-sync and TDM slots
5. **Edge Intelligence Context** — WASM module dispatch and event generation
6. **Disaster Response Context** (WiFi-Mat) — Survivor detection, START triage, mass casualty
7. **Cognitum Integration Context** — RVF vector store, witness chains, persistent memory

---

## Hardware Setup & Firmware

### ESP32-S3 Sensor Node

**Board Requirements:**
- **Chipset**: ESP32-S3 (QFN56) — dual-core Xtensa LX7 @ 240 MHz
- **Flash**: 8 MB minimum (943 KB used by firmware, rest for OTA/SPIFFS)
- **PSRAM**: 8 MB (640 KB used by WASM arenas)
- **USB Bridge**: Silicon Labs CP210x (for flashing + serial monitor)
- **Recommended**: ESP32-S3-DevKitC-1, XIAO ESP32-S3

**NOT Supported:**
- Original ESP32 — single-core, insufficient for CSI DSP
- ESP32-C3 — single-core, insufficient for CSI DSP

### Building Firmware

**Prerequisites:**
- Docker (required — `idf.py` does not work on Windows without Docker)
- esptool 5.x+: `pip install esptool`
- Python 3.10+

**Build Command** (from repo root):
```bash
MSYS_NO_PATHCONV=1 docker run --rm \
  -v "$(pwd)/firmware/esp32-csi-node:/project" -w /project \
  espressif/idf:v5.2 bash -c \
  "rm -rf build sdkconfig && idf.py set-target esp32s3 && idf.py build"
```

**Outputs:**
- `build/bootloader/bootloader.bin`
- `build/partition_table/partition-table.bin`
- `build/esp32-csi-node.bin` (application)

### Flashing Firmware

**Find Serial Port:**
- Windows: `COM7` (or check Device Manager for "Silicon Labs" or "CP210x")
- Linux: `/dev/ttyUSB0` or `/dev/ttyACM0`
- macOS: `/dev/cu.SLAB_USBtoUART`

**Flash Command:**
```bash
python -m esptool --chip esp32s3 --port COM7 --baud 460800 \
  write_flash --flash_mode dio --flash_size 8MB \
  0x0     bootloader.bin \
  0x8000  partition-table.bin \
  0x10000 esp32-csi-node.bin
```

**Verify Boot:**
```bash
python -m serial.tools.miniterm COM7 115200
```

Expected:
```
I (321) main: ESP32-S3 CSI Node (ADR-018) -- Node ID: 1
I (345) main: WiFi STA initialized, connecting to SSID: wifi-densepose
I (1023) main: Connected to WiFi
I (1025) main: CSI streaming active -> 192.168.1.100:5005 (edge_tier=2, OTA=ready, WASM=ready)
```

### Provisioning WiFi Credentials

**Script Method** (recommended):
```bash
python firmware/esp32-csi-node/provision.py \
  --port COM7 \
  --ssid "YourWiFi" \
  --password "YourPassword" \
  --target-ip 192.168.1.20 \
  --node-id 1
```

**Parameters:**
- `--target-ip`: Your laptop's local IP (not the Seed; the aggregator runs on your laptop)
- `--node-id`: 1, 2, 3, ... (unique per node)
- `--edge-tier`: 0 (raw CSI), 1 (DSP), 2 (vitals), 3 (WASM) — default 2

**Verify Streaming:**
```bash
python -c "
import socket, struct
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind(('0.0.0.0', 5006))
sock.settimeout(10)
print('Listening on UDP 5006 for 10 seconds...')
count = 0
try:
    while True:
        data, addr = sock.recvfrom(2048)
        count += 1
        if count <= 5:
            print(f'  Packet {count} from {addr[0]} ({len(data)} bytes)')
except socket.timeout:
    pass
sock.close()
print(f'Received {count} packets total')
"
```

### Firmware Tiers

| Tier | Name | Features | Output | Bandwidth |
|------|------|----------|--------|-----------|
| 0 | Raw CSI | Passthrough CSI frames | ADR-018 binary (56-192 subcarriers × I/Q) | ~5 KB/s |
| 1 | Signal Conditioning | Phase unwrap, variance, top-K, compression | Delta-compressed frames | ~1.5 KB/s |
| 2 | Full Pipeline | Vitals, presence, fall detection, person counting | Vitals packet (32 B, 1 Hz) | ~32 bytes/s + events |
| 3 | WASM Modules | Custom logic, hot-swap sensing modules | Module-specific events | Variable |

**Select Tier:**
```bash
# At flash time (Kconfig)
docker run ... idf.py menuconfig
# → Component config → ESP32-S3 CSI Sensor → Edge Processing Tier

# At runtime (NVS — no reflash)
python scripts/set_nvm.py --port COM7 --edge-tier 3
```

### Multi-Node Mesh (TDM)

For 3+ nodes in the same room without interference:

**Time-Division Multiplexing (TDM):**
- Node 1: transmits on channel 1
- Node 2: transmits on channel 6 (non-overlapping)
- Node 3: transmits on channel 11 (non-overlapping)
- All receive continuously
- Each node's transmit window: 100ms
- Dwell per channel: 200ms (ADR-073)

**Setup:**
```bash
# Node 1
python provision.py --port COM7 --node-id 1 --channel 1 --tdm-mode

# Node 2
python provision.py --port COM8 --node-id 2 --channel 6 --tdm-mode

# Node 3
python provision.py --port COM9 --node-id 3 --channel 11 --tdm-mode
```

**What Multi-Node Gives You:**

| Capability | 1 Node | 3 Nodes | 6 Nodes |
|-----------|--------|---------|---------|
| Presence detection | Good | Excellent | Excellent |
| Coarse motion | Good | Excellent | Excellent |
| Room-level location | None | Good | Excellent |
| Respiration accuracy | Marginal | Good | Good |
| Heartbeat | Poor | Poor | Marginal |
| Multi-person count | None | Marginal | Good |
| Pose estimation | None | Poor | Marginal |

---

## Software Pipelines

### Python Pipeline (v1/)

**Status**: Stable, used for prototyping and deterministic verification.

**Location**: `v1/` directory

**Key Components:**
- `v1/src/api/main.py` — FastAPI HTTP/WebSocket server
- `v1/src/sensing/` — Commodity WiFi sensing (RSSI without custom hardware)
- `v1/data/proof/verify.py` — Deterministic signal processing pipeline proof
- `v1/requirements-lock.txt` — Pinned dependencies for reproducibility

**Install:**
```bash
# Verification only (lightweight)
pip install -r v1/requirements-lock.txt

# Full pipeline with API server
pip install -r requirements.txt
```

**Run API Server:**
```bash
uvicorn v1.src.api.main:app --host 0.0.0.0 --port 8000 --reload
```

**Run Verification** (no hardware needed):
```bash
python3 v1/data/proof/verify.py
# or via shell wrapper
./verify --verbose --audit
```

**Endpoints:**
- `GET /docs` — OpenAPI docs
- `GET /health` — Health check
- `GET /api/v1/pose/latest` — Latest detected poses
- `WS /ws/pose/stream` — WebSocket pose stream (real-time)
- `WS /ws/analytics/events` — Analytics events

### Rust Pipeline (v2)

**Status**: Production, 810x faster than Python.

**Location**: `rust-port/wifi-densepose-rs/` (monorepo workspace)

**Workspace Crates:**

| Crate | Purpose | Stability |
|-------|---------|-----------|
| `wifi-densepose-core` | Types, traits, domain models | Stable |
| `wifi-densepose-signal` | FFT, phase unwrapping, Doppler, correlation | Stable |
| `wifi-densepose-nn` | ONNX Runtime + Candle inference | Stable |
| `wifi-densepose-hardware` | ESP32, Intel 5300, Atheros adapters + UDP | Stable |
| `wifi-densepose-api` | Axum HTTP/WebSocket server | Stable |
| `wifi-densepose-db` | SQLx + PostgreSQL/SQLite/Redis | Stable |
| `wifi-densepose-config` | Settings from env/YAML/TOML | Stable |
| `wifi-densepose-wasm` | WebAssembly browser + edge module runtime | Stable |
| `wifi-densepose-wasm-edge` | 60+ edge modules (medical, security, retail) | Stable |
| `wifi-densepose-cli` | Command-line tools | Stable |
| `wifi-densepose-vitals` | Vital sign detection pipeline | Partial |
| `wifi-densepose-mat` | Disaster response (WiFi-Mat) | Stable |
| `wifi-densepose-train` | Training pipeline integration | Partial |
| `wifi-densepose-desktop` | Desktop app (Tauri) | Partial |
| `wifi-densepose-ruvector` | RuVector model integration | Stable |
| `wifi-densepose-sensing-server` | Single-binary integrated sensing server | Stable |

**Build Individual Crate:**
```bash
cd rust-port/wifi-densepose-rs

# Signal processing only
cargo build --release --package wifi-densepose-signal

# API server
cargo build --release --package wifi-densepose-api

# Sensing server (integrated)
cargo build --release --package wifi-densepose-sensing-server

# WASM for browser
cargo build --release --package wifi-densepose-wasm --target wasm32-unknown-unknown
```

**Run Full API Server:**
```bash
cd rust-port/wifi-densepose-rs
cargo run --release --package wifi-densepose-api -- \
  --http-port 8000 \
  --ws-port 8001 \
  --data-source esp32-aggregator \
  --database-url postgresql://user:pass@localhost/wifi_densepose
```

**Run Integrated Sensing Server** (simpler, single binary):
```bash
cd rust-port/wifi-densepose-rs
cargo run --release --package wifi-densepose-sensing-server -- \
  --http-port 3000 \
  --source auto  # auto-detect ESP32 nodes or use simulated mode
```

**Performance Metrics:**
- CSI preprocessing: 5.19 µs per frame
- Feature extraction: 9.03 µs per frame
- Full pipeline: 18.47 µs per frame
- **Throughput**: 54,000 FPS (per single core)
- **Latency**: 0.012 ms per inference

### Verification (No Hardware)

**Purpose**: Prove the signal processing pipeline is deterministic and correct without any WiFi hardware.

**Run:**
```bash
./verify                    # Quick check (30 seconds)
./verify --verbose          # With detailed statistics
./verify --verbose --audit  # + codebase mock elimination scan
```

**How It Works:**
1. Loads reference CSI data from `v1/data/proof/sample_csi_data.json`
2. Runs the full signal processing chain (noise filtering, FFT, Doppler, PSD)
3. Computes SHA-256 hash of the output
4. Compares to published expected hash in `v1/data/proof/expected_features.sha256`

**Exit Codes:**
- `0` — PASS (hash match)
- `1` — FAIL (hash mismatch or error)
- `2` — SKIP (expected hash file missing)

---

## API Reference

### REST Endpoints (Sensing Server)

**Base URL**: `http://localhost:3000/api/v1/`

#### Pose Endpoints

**GET `/pose/latest`**
- Returns the most recent detected pose
- Response:
  ```json
  {
    "timestamp": 1713628800000,
    "keypoints": [
      {"x": 0.5, "y": 0.3, "confidence": 0.95},
      ...
    ],
    "source": "ESP32",
    "model_version": "wiflow-v1"
  }
  ```

**GET `/pose/history?limit=100&offset=0`**
- Returns historical poses
- Query params: `limit` (max 1000), `offset`, `since_ms`

#### Node Endpoints

**GET `/nodes`**
- List all connected ESP32 nodes
- Response:
  ```json
  {
    "nodes": [
      {"id": 1, "ip": "192.168.1.105", "rssi": -45, "uptime_ms": 3600000},
      {"id": 2, "ip": "192.168.1.104", "rssi": -52, "uptime_ms": 3598000}
    ]
  }
  ```

**GET `/nodes/{id}/health`**
- Node health/status
- Response includes: `csi_frame_rate`, `battery_pct`, `temperature`, `drift_alert`

#### Vital Signs Endpoints

**GET `/vitals/breathing`**
- Current breathing rate
- Response: `{"bpm": 16.5, "confidence": 0.92, "pattern": "regular"}`

**GET `/vitals/heart-rate`**
- Current heart rate
- Response: `{"bpm": 72.3, "confidence": 0.85, "pattern": "regular"}`

#### Recording Endpoints

**POST `/recording/start`**
- Start capturing CSI frames to disk
- Body: `{"session_name": "session-1", "label": "optional-label", "duration_secs": 300}`
- Response: `{"session_id": "uuid", "status": "recording"}`

**GET `/recording/{session_id}/status`**
- Recording status and frame count
- Response: `{"frames": 1250, "duration_secs": 62, "file_size_mb": 5.2}`

**POST `/recording/{session_id}/stop`**
- Stop recording
- Response: `{"frames_total": 1250, "file": "session-1.csi.jsonl"}`

#### Model Management

**GET `/models`**
- List available inference models
- Response: 
  ```json
  {
    "models": [
      {"name": "wiflow-v1", "type": "pose", "accuracy_pck20": 0.929, "size_kb": 974}
    ]
  }
  ```

**POST `/models/download?name=wiflow-v1&version=1.0`**
- Download and cache a model
- Response: `{"model": "wiflow-v1", "cached": true}`

### WebSocket Channels

**Connect**: `ws://localhost:3000/api/v1/stream/{channel}`

**Channels:**

| Channel | Data | Rate |
|---------|------|------|
| `pose` | Detected keypoints (17 COCO points) | Per-frame (20-30 Hz) |
| `vitals` | Breathing/HR with confidence | 1 Hz |
| `presence` | Binary presence + occupancy count | 1 Hz |
| `events` | Domain-specific events (falls, gestures, etc.) | Event-driven |
| `raw-csi` | Raw CSI amplitudes (all subcarriers) | 20 Hz |

**Example (Node.js):**
```javascript
const ws = new WebSocket('ws://localhost:3000/api/v1/stream/pose');
ws.onmessage = (event) => {
  const pose = JSON.parse(event.data);
  console.log(`Pose confidence: ${pose.confidence}`);
  pose.keypoints.forEach((kp, i) => {
    console.log(`  Joint ${i}: (${kp.x}, ${kp.y}) conf=${kp.confidence}`);
  });
};
```

---

## Edge Intelligence Modules

### Overview

**65 WASM modules** that execute directly on ESP32 without requiring cloud connectivity or firmware reflash. Each module is 5-30 KB, runs in <10 milliseconds, and can be hot-swapped by uploading a new RVF container.

**Module Categories:**

| Category | Count | Example Modules |
|----------|-------|-----------------|
| Core | 7 | Presence, motion, coherence, anomaly, gesture baseline |
| Medical | 5 | Sleep apnea, cardiac arrhythmia, gait analysis, seizure, stress |
| Security | 6 | Intrusion, perimeter, loitering, unauthorized access, tailgating, weapon |
| Building | 5 | HVAC occupancy, lighting, elevator counting, meeting detection |
| Retail | 5 | Queue length, dwell heatmap, customer flow, product engagement |
| Industrial | 5 | Forklift proximity, confined space, vibration monitoring |
| Exotic | 10+ | Dream detection, emotion, sign language, rain, speaker ID |
| Signal Intelligence | 6 | Attention, coherence gate, compression ratio, recovery time |
| Adaptive Learning | 4 | Online adaptation, attractor, EWC (elastic weight consolidation) |
| Spatial Reasoning | 6 | HNSW matching, influence scoring, spike tracking |
| Temporal Analysis | 6+ | Pattern detection, LTL violations, GOAP planning |

### How to Use a Module

**1. Build/Download:**
```bash
# From rust-port/wifi-densepose-rs/
cargo build --release --package wifi-densepose-wasm-edge --target wasm32-unknown-unknown

# Output: target/wasm32-unknown-unknown/release/module_name.wasm
# Package into RVF: target/module_name.rvf (signed, versioned container)
```

**2. Upload to ESP32:**
```bash
# Via REST API
curl -X POST http://<ESP32_IP>:8032/wasm/upload \
  --data-binary @module_name.rvf

# Or via Python script
python scripts/upload_wasm.py --port COM7 --module gesture_detector.rvf
```

**3. List Loaded Modules:**
```bash
curl http://<ESP32_IP>:8032/wasm/list
# Response:
# {
#   "modules": [
#     {"name": "gesture_detector", "version": "1.0.0", "size_bytes": 18432}
#   ]
# }
```

**4. Read Module Output:**
Connect to the WebSocket or UDP stream and filter for events emitted by the module (defined by event ID ranges in the module spec).

### Writing a Custom Module

**Rust Template** (60 lines):
```rust
#![cfg_attr(not(feature = "std"), no_std)]
#[cfg(not(feature = "std"))]
use libm::fabsf;

/// Your custom gesture detector
pub struct GestureDetector {
    phase_history: [f32; 64],
    history_idx: usize,
}

impl GestureDetector {
    /// Constructor (fixed-size only — no allocation)
    pub const fn new() -> Self {
        GestureDetector {
            phase_history: [0.0; 64],
            history_idx: 0,
        }
    }

    /// Process one CSI frame, return event list
    pub fn process_frame(&mut self) -> &[(i32, f32)] {
        // 1. Read CSI data from host functions
        let phase_0 = unsafe { csi_get_phase(0) };
        let amplitude_0 = unsafe { csi_get_amplitude(0) };

        // 2. Update history
        self.phase_history[self.history_idx] = phase_0;
        self.history_idx = (self.history_idx + 1) % 64;

        // 3. Detect gesture (example: large phase acceleration)
        let phase_delta = (phase_0 - self.phase_history[(self.history_idx + 1) % 64]).abs();
        if phase_delta > 0.5 {
            // Emit event: ID=50 (gesture), value=delta
            unsafe {
                csi_emit_event(50, phase_delta);
            }
        }

        // Return empty (events go directly to host)
        &[]
    }
}

// Host function declarations (provided by firmware)
extern "C" {
    fn csi_get_phase(i: i32) -> f32;
    fn csi_get_amplitude(i: i32) -> f32;
    fn csi_emit_event(id: i32, value: f32);
    fn csi_log(ptr: *const u8, len: usize);
}

// Tests
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new() {
        let detector = GestureDetector::new();
        assert_eq!(detector.history_idx, 0);
    }
}
```

**Build & Package:**
```bash
cargo build --release --target wasm32-unknown-unknown
wasm-opt -O4 target/wasm32-unknown-unknown/release/gesture_detector.wasm \
  -o gesture_detector.wasm
# Sign with Ed25519 and create RVF container
python scripts/create_rvf.py --wasm gesture_detector.wasm \
  --name gesture_detector --version 1.0.0 \
  --output gesture_detector.rvf
```

### Event ID Registry

**Event ID ranges for different domains:**

| Range | Category | Purpose |
|-------|----------|---------|
| 0-99 | Core Sensing | Presence, motion, anomaly, coherence score |
| 100-199 | Medical | Apnea, arrhythmia, seizure, stress score |
| 200-299 | Security | Intrusion, perimeter breach, loitering, weapon |
| 300-399 | Smart Building | HVAC, lighting, elevator, meeting room |
| 400-499 | Retail | Queue, dwell, flow, engagement |
| 500-599 | Industrial | Proximity, confined space, vibration |
| 600-699 | Exotic | Dream stage, emotion, gesture language, rain |
| 700-729 | Signal Intel | Attention, coherence gate, compression |
| 730-759 | Adaptive Learning | Gesture learned, adaptation, EWC |
| 760-789 | Spatial Reasoning | Influence, HNSW match, spike |
| 790-819 | Temporal Analysis | Pattern, LTL violation, GOAP goal |
| 820-849 | AI Security | Replay attack, injection, jamming |
| 850-879 | Quantum | Entanglement, decoherence, hypothesis |
| 880-899 | Autonomous | Inference, rule fired, mesh reconfig |

---

## Configuration & Deployment

### Docker Deployment

**Development** (with hot-reload, Postgres, Redis, Prometheus, Grafana):
```bash
docker compose up
```

Services:
- `wifi-densepose-dev` (port 8000) — API with reload
- `postgres` (port 5432) — Database
- `redis` (port 6379) — Cache
- `prometheus` (port 9090) — Metrics
- `grafana` (port 3000) — Dashboards (admin/admin)
- `nginx` (ports 80, 443) — Reverse proxy

**Run tests inside container:**
```bash
docker compose exec wifi-densepose pytest tests/ -v
```

**Production** (multi-replica with Swarm):
```bash
# Build production image
docker build --target production -t wifi-densepose:latest .

# Deploy stack
docker stack deploy -c docker-compose.prod.yml wifi-densepose
```

Features:
- 3 API server replicas with rolling updates
- Resource limits (2 CPU, 4 GB RAM per replica)
- Health checks on all services
- JSON file logging with rotation
- 15-day Prometheus retention
- Secret management via Docker Swarm

### Environment Variables

**Key `.env` Settings:**

```env
# Database
DATABASE_URL=postgresql://user:password@postgres:5432/wifi_densepose
REDIS_URL=redis://redis:6379/0

# Server
SECRET_KEY=your-long-random-secret
JWT_SECRET=your-jwt-secret
ALLOWED_HOSTS=localhost,127.0.0.1,your-domain.com

# Features
ENABLE_WASM_MODULES=true
ENABLE_TRAINING=false
ENABLE_MAT=true

# Logging
LOG_LEVEL=info
SENTRY_DSN=optional-sentry-url

# Hardware
ESP32_UDP_PORT=5006
ESP32_TARGET_IP=192.168.1.20
```

### Standalone (No Docker)

**Python:**
```bash
# Install
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run
uvicorn v1.src.api.main:app --host 0.0.0.0 --port 8000 --workers 4
```

**Rust:**
```bash
cd rust-port/wifi-densepose-rs
cargo run --release --package wifi-densepose-sensing-server -- --http-port 3000
```

---

## Cognitum Seed Integration

### Overview

The **Cognitum Seed** (Raspberry Pi Zero 2 W + RVF vector database) provides persistent memory and intelligent vector storage for WiFi sensing data. It's a self-contained edge appliance that talks to RuView via HTTPS bearer tokens.

**Use Cases:**
- Store pretraining datasets (3,600+ vectors from 30-minute sessions)
- Query nearest neighbors (kNN search) for environment fingerprinting
- Maintain SHA-256 witness chains for data integrity
- Run compact ML models without a laptop

**Hardware:**
- Cognitum Seed ($131)
- Plugs into laptop via USB-C (link-local HTTPS at 169.254.42.1)
- Can also be WiFi-connected

### Setup

**Step 1: Connect & Verify**
```bash
curl -sk https://169.254.42.1:8443/api/v1/status
# Response: {"device_id": "...", "total_vectors": 0, "epoch": 1, "dimension": 8}
```

**Step 2: Pair (USB-only, generates bearer token)**
```bash
curl -sk -X POST https://169.254.42.1:8443/api/v1/pair \
  -H "Content-Type: application/json" \
  -d '{"client_name": "wifi-densepose-bridge"}'
# Response: {"token": "seed_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}

export SEED_TOKEN="seed_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Step 3: Run Bridge (Python, streams ESP32 data to Seed)**
```bash
python scripts/seed_csi_bridge.py \
  --seed-url https://169.254.42.1:8443 \
  --token "$SEED_TOKEN" \
  --udp-port 5006 \
  --batch-size 10 \
  --validate
```

**Bridge Flags:**
- `--validate` — After each batch, run kNN + PIR comparison (slows ingest, confirms quality)
- `--stats` — Print Seed status and exit
- `--compact` — Trigger store compaction
- `--allowed-sources` — Comma-separated ESP32 IPs (anti-spoofing)
- `-v / --verbose` — Log every packet

### Data Collection Protocol

**6 Scenarios × 5 minutes each = 30 minutes total**

```bash
# Scenario 1: Empty room (baseline)
echo "Leaving room for 5 minutes..."
sleep 300

# Scenario 2: One person stationary (breathing, heart rate)
echo "Sitting still for 5 minutes..."
sleep 300

# Scenario 3: One person walking (activity recognition)
echo "Walking around room for 5 minutes..."
sleep 300

# Scenario 4: One person varied activity (diverse motions)
echo "Varied movement (sit, stand, wave, reach) for 5 minutes..."
sleep 300

# Scenario 5: Two people (multi-person)
echo "Two people moving around for 5 minutes..."
sleep 300

# Scenario 6: Transitions (enter/exit)
echo "Enter and exit room repeatedly for 5 minutes..."
sleep 300
```

**Expected Output:**
- 30 minutes of data collection
- ~1,800 vectors per ESP32 node
- ~3,600 total vectors (2 nodes)
- 150 KB RVF store size
- 360+ witness chain entries

### Querying the Seed

**Check Status:**
```bash
curl -sk https://169.254.42.1:8443/api/v1/status \
  -H "Authorization: Bearer $SEED_TOKEN"
```

**kNN Query** (find 5 neighbors to a "presence" vector):
```bash
curl -sk -X POST https://169.254.42.1:8443/api/v1/store/query \
  -H "Authorization: Bearer $SEED_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"vector": [0.8, 0.5, 0.5, 0.6, 0.5, 0.25, 0.0, 0.6], "k": 5}'
```

**Verify Witness Chain:**
```bash
curl -sk -X POST https://169.254.42.1:8443/api/v1/witness/verify \
  -H "Authorization: Bearer $SEED_TOKEN"
```

**Export Vectors (for training):**
```bash
curl -sk https://169.254.42.1:8443/api/v1/store/export \
  -H "Authorization: Bearer $SEED_TOKEN" \
  -o pretrain-vectors.rvf
```

### Feature Vector Dimensions

Each ESP32 emits an 8-dimensional feature vector (normalized 0.0-1.0):

| Dim | Name | Source | Normalization | Range |
|-----|------|--------|---------------|-------|
| 0 | Presence score | CSI variance | / 15.0 clamped | 0.0-1.0 |
| 1 | Motion energy | Subcarrier variance | / 10.0 clamped | 0.0-1.0 |
| 2 | Breathing rate BPM | Bandpass 0.1-0.5 Hz | / 30.0 clamped | 0.0-1.0 |
| 3 | Heart rate BPM | Bandpass 0.8-2.0 Hz | / 120.0 clamped | 0.0-1.0 |
| 4 | Phase variance | Welford per-subcarrier | Mean of top-K | 0.0-1.0 |
| 5 | Person count | Subcarrier clustering | / 4.0 clamped | 0.0-1.0 |
| 6 | Fall detected | Phase acceleration | 1.0 if fall, 0.0 else | {0.0, 1.0} |
| 7 | RSSI | WiFi signal strength | (rssi + 100) / 100 | 0.0-1.0 |

**Example Reading:**
```
[0.99, 0.47, 0.67, 0.63, 0.50, 0.25, 0.00, 0.57]
 ↓     ↓     ↓     ↓     ↓     ↓     ↓     ↓
Strong Moderate 20.1 75.6  Phase  1      No   -43
pres.  motion   BPM  BPM   var.   person fall dBm
```

---

## Troubleshooting & Known Issues

### Node Not Appearing in /api/v1/nodes

**Symptom**: ESP32 associates with WiFi, LED blinks, but CSI frames don't arrive.

**Root Cause**: After USB flash, node enters a "limping state" where WiFi associates but UDP sender silently fails.

**Fix**: Power cycle (unplug USB, wait 2s, replug). Or send DTR reset:
```bash
python -m serial.tools.miniterm --dtr 0 COM7 115200
# Then Ctrl+C
```

**Prevention**: Firmware 0.8.0+ includes a 30-second watchdog that auto-resets nodes with zero CSI frames.

### Person Count Stuck at 1

**Symptom**: `estimated_persons` always returns 1 regardless of occupancy.

**Root Cause**: Eight bugs converged (ceiling clamp, `.max()` aggregation, normalization saturation, etc.).

**Fix Applied**: 
- Ceiling 3 → 10
- `.max()` → sum/3 aggregation
- Softened `.max(1)` clamps
- RollingP95 adaptive normalization
- Field model auto-calibration
- Symmetric vitals clamps

**Current State**: Overcounts 6-8 for 5 bodies. Still not perfect. Runtime-configurable lambda would help.

### Heart Rate / Breathing Rate Jitter

**Symptom**: HR and BR readings jump wildly (BR CV 23.3%, HR CV 12.9%).

**Root Cause**: 11 ESP32 nodes each compute independent vitals. Server used last-write-wins, so vitals randomly interleaved every 50ms.

**Fix Applied**: Best-node selection. Each node's vitals are smoothed independently, and the node with highest combined confidence is authoritative.

**Result**: BR CV 23.3% → 12.6%, HR CV 12.9% → 11.6%.

**Known Limitation**: The superior `wifi-densepose-vitals` crate (4-stage bandpass → Hilbert → autocorrelation → peak detection) is not yet wired into the sensing server.

### Signal Quality Shows 50% Always

**Symptom**: Dashboard signal quality gauge stuck at ~50%.

**Root Cause**: Hardcoded placeholder value, not derived from CSI data.

**Fix Applied**: RollingP95 adaptive normalization based on actual CSI variance. UI honesty pass replaced fake gauge with per-node signal quality pills.

### Dashboard Freezes Every 2-4 Seconds

**Symptom**: WebSocket freezes, reconnects, creating visible stutter.

**Root Cause**: `recv()` returned `Err(Lagged)` when client fell behind. Server treated as fatal error and dropped connection.

**Fix Applied**:
- `Lagged` error → `continue` (skip missed frames)
- 30s ping/pong keepalive (prevent proxy timeouts)
- Result: 154 frames over 8 seconds sustained, zero disconnects

### OTA Update Crashes at 59%

**Symptom**: Firmware OTA progresses to ~59%, then `StoreProhibited` error on Core 1.

**Root Cause**: NimBLE (BLE advertising) and OTA both run on Core 1, compete for stack space.

**Fix**:
1. Stop BLE advertising/scanning before OTA
2. Increase HTTPD stack from 4 KB to 8 KB
3. Resume BLE after OTA completes

**Caveat**: Nodes on old firmware (lack watchdog) must be USB-flashed with 0.8.0+ before OTA works.

### Right USB-C Port Doesn't Work

**Symptom**: Right USB-C port (when facing device) shows no serial device on host.

**Fix**: Use the left USB-C port. Right port is native USB (USB-JTAG), not used by RuView firmware.

### Can't SSH to Babycube via LAN

**Symptom**: `ssh thyhack@10.0.10.10` hangs at banner exchange.

**Workaround**: Use Tailscale IP: `ssh thyhack@100.90.238.87`

**Suspected Cause**: Unknown. Possibly MTU/fragmentation on LAN segment. Not CrowdSec.

---

## Architecture Decision Records

RuView documents every major technical choice in **Architecture Decision Records (ADRs)**. There are **81 ADRs** covering:

### Key ADRs (Recommended Reading)

**Hardware & Firmware:**
- **ADR-012**: ESP32-S3 CSI Sensor Mesh for Distributed Sensing
- **ADR-018**: ESP32 Development Implementation Path
- **ADR-028**: ESP32 Capability Audit and Witness Record
- **ADR-029**: RuvSense Multistatic Sensing Mode (TDM, channel hopping)
- **ADR-039**: ESP32-S3 Edge Intelligence Pipeline (on-device vitals)
- **ADR-040**: WASM Programmable Sensing (Tier 3)
- **ADR-041**: WASM Module Collection (65 edge modules)
- **ADR-081**: Adaptive CSI Mesh Firmware Kernel (latest architecture)

**Signal Processing:**
- **ADR-013**: Feature-Level Sensing on Commodity Gear (RSSI without CSI)
- **ADR-014**: SOTA Signal Processing Algorithms
- **ADR-021**: Vital Sign Detection (breathing, heart rate)
- **ADR-042**: Coherent Human Channel Imaging (sub-mm body reconstruction)
- **ADR-073**: Multi-frequency Mesh Scanning (channel hopping)
- **ADR-074**: Spiking Neural CSI Sensing (sub-30s adaptation)

**Machine Learning:**
- **ADR-005**: SONA Self-Learning for Pose Estimation
- **ADR-006**: GNN-Enhanced CSI Pattern Recognition
- **ADR-015**: Public Dataset Training Strategy
- **ADR-016**: RuVector Training Pipeline Integration
- **ADR-020**: Rust AI Inference Migration (ONNX Runtime)
- **ADR-070**: Self-Supervised Pretraining (contrastive learning)
- **ADR-071**: RuLLM Training Pipeline
- **ADR-079**: Camera Ground-Truth Training (92.9% PCK@20)

**Platform & Integration:**
- **ADR-001**: WiFi-Mat Disaster Detection Architecture
- **ADR-009**: RVF WASM Runtime for Edge Deployment
- **ADR-010**: Witness Chains for Audit Trail Integrity
- **ADR-034**: Expo React Native Mobile App
- **ADR-052**: Tauri Desktop Frontend
- **ADR-055**: Integrated Sensing Server (single binary)
- **ADR-069**: Cognitum Seed CSI Pipeline

**All 81 ADRs** are in `/docs/adr/` with Status (Proposed/Accepted/Superseded), Context, Decision, Consequences, and References.

---

## Domain-Driven Design Models

### Bounded Contexts

RuView is organized into **7 major domain models**, each defining its bounded context, aggregates, value objects, and invariants:

**1. RuvSense Domain Model** (`ruvsense-domain-model.md`)
- **Contexts**: Sensing, Coherence, Tracking, Field Model, Longitudinal, Spatial Identity, Edge Intelligence
- **Key Aggregates**: 
  - `CsiFrame` (raw subcarrier I/Q values)
  - `FeatureVector` (8-dim normalized sensing output)
  - `PoseTrack` (17-point skeleton across frames)
  - `CoherenceEstimate` (multi-node fusion confidence)

**2. Signal Processing Domain Model** (`signal-processing-domain-model.md`)
- **Contexts**: CSI Preprocessing, Feature Extraction, Motion Analysis
- **Key Aggregates**:
  - `PhaseUnwrappedFrame` (2π discontinuities removed)
  - `SpectralFeature` (FFT subcarrier power)
  - `VitalSignFeature` (bandpass-extracted breathing/HR)

**3. Training Pipeline Domain Model** (`training-pipeline-domain-model.md`)
- **Contexts**: Dataset Management, Model Architecture, Training Orchestration, Embedding & Transfer
- **Key Aggregates**:
  - `Dataset` (versioned CSI recordings with ground truth)
  - `ModelCheckpoint` (ONNX weights + metadata)
  - `TrainingSession` (hyperparameters, loss curves, domain gaps)

**4. Hardware Platform Domain Model** (`hardware-platform-domain-model.md`)
- **Contexts**: Sensor Node, Edge Processing, WASM Runtime, Aggregation, Provisioning
- **Key Aggregates**:
  - `SensorNode` (ESP32 with firmware version, config, health)
  - `WasmModule` (RVF container + execution sandbox)
  - `FeatureStreamAggregator` (multi-node fusion)

**5. Sensing Server Domain Model** (`sensing-server-domain-model.md`)
- **Contexts**: CSI Ingestion, Model Management, CSI Recording, Training Pipeline, Visualization
- **Key Aggregates**:
  - `IngestSession` (active UDP listener for ESP32 streams)
  - `RecordingSession` (buffered CSI → `.csi.jsonl` file)
  - `TrainingRequest` (model retraining triggered by API)

**6. WiFi-Mat (Disaster Response) Domain Model** (`wifi-mat-domain-model.md`)
- **Contexts**: Detection, Localization, Alerting
- **Key Aggregates**:
  - `DisasterEvent` (incident root + zones + survivors)
  - `SurvivorTrack` (vital signs + triage status + location)
  - `TriageAlert` (START classification + priority)

**7. CHCI (Coherent Human Channel Imaging)** (`chci-domain-model.md`)
- **Contexts**: Sounding, Channel Estimation, Imaging
- **Key Aggregates**:
  - `CoherentFrame` (phase-coherent multi-antenna CSI)
  - `ChannelMatrix` (estimated body surface impedance)
  - `SurfaceReconstruction` (3D mesh from imaging)

### Anti-Corruption Layers

Each domain defines **adapters** to translate between contexts without leaking internals:

- **Hardware → Signal**: `RawCsiFrame` → `CsiFrame` (subcarrier normalization, phase unwrap)
- **Signal → ML**: `FeatureVector` → `ModelInput` (8-dim → model's expected input shape)
- **ML → API**: `PoseTrack` → `PoseJson` (COCO keypoints → HTTP response format)
- **Server → Seed**: `FeatureVector` → `SeedVector` (8-dim RuView → 8-dim Seed VectorDB)

---

## Training & Model Management

### Pre-trained Models

**Available on HuggingFace** at `https://huggingface.co/ruv/ruview/`:

**WiFlow-v1** (Pose)
- **Accuracy**: 92.9% PCK@20 (Percent Correct Keypoints at 20 px threshold)
- **Model Size**: 974 KB (186,946 parameters)
- **Quantized (int4)**: 8 KB
- **Training Data**: 5 minutes (345 samples with camera ground truth)
- **Architecture**: TCN + axial attention
- **Input**: 56 CSI subcarriers (amplitude only)
- **Output**: 17 COCO keypoints (x, y, confidence per joint)

**Presence Detector**
- **Accuracy**: 100% on 60,630 overnight samples
- **Model Size**: 48 KB
- **Architecture**: Random forest (interpretable)
- **Input**: Phase variance + motion energy
- **Output**: Binary presence + confidence

**LoRA Adapters** (per-room fine-tuning)
- Lightweight domain adaptation (5-10 KB per room)
- Train on 30-minute local data collection
- Achieves 2-5% accuracy improvement vs. base model

### Training Pipelines

**Phase 1: Self-Supervised Pretraining (ADR-070)**
- Collect 30 minutes of CSI data (ESP32 + Cognitum Seed)
- Contrastive learning (temporal coherence + multi-node consistency)
- No labels required
- Result: 8-dimensional embeddings (3,600 vectors)

**Phase 2: Supervised Fine-tuning (ADR-079)**
- Collect paired CSI + camera ground truth (MediaPipe)
- 5-minute synchronized recording
- Curriculum training: contrastive → supervised → temporal refinement
- 92.9% accuracy achievable

**Phase 3: Domain Generalization (ADR-027)**
- Elastic Weight Consolidation (EWC) prevents catastrophic forgetting
- Train on new room without degrading old rooms
- Automatic domain gap detection

**Phase 4: Distribution (RVF Format)**
- Single-file container with Ed25519 signature
- 3-layer progressive loading (instant/warm/full)
- Versioning + rollback support

### Camera-Free Pose Training

**Pipeline** (scripts in `scripts/`):

**1. Collect CSI Data** (5 minutes):
```bash
python scripts/record-csi-udp.py \
  --output session-1.csi.jsonl \
  --duration 300 \
  --esp32-ip 192.168.1.105
```

**2. Collect Ground Truth** (paired webcam):
```bash
python scripts/collect-ground-truth.py \
  --video-source 0 \
  --csi-file session-1.csi.jsonl \
  --output ground-truth.json
```

**3. Align (Time-sync keypoints with CSI windows):
```bash
node scripts/align-ground-truth.js \
  --csi session-1.csi.jsonl \
  --keypoints ground-truth.json \
  --output aligned.jsonl
```

**4. Train (Curriculum with 3 presets):
```bash
node scripts/train-wiflow-supervised.js \
  --dataset aligned.jsonl \
  --preset lite  # 189K params, 19 min
  # or small/medium/full
  --output model.safetensors
```

**5. Evaluate:
```bash
node scripts/eval-wiflow.js \
  --model model.safetensors \
  --dataset aligned.jsonl \
  # Produces: PCK@10/20/50, MPJPE, per-joint breakdown
```

### RuVector Integration

**RuVector** is a Rust-based training framework integrated into the full pipeline.

**Usage** (Rust):
```bash
cd rust-port/wifi-densepose-rs

cargo run -p wifi-densepose-train -- \
  --data pretrain-vectors.rvf \
  --epochs 50 \
  --output model.onnx \
  --device gpu  # or cpu
```

**Features:**
- Contrastive learning (NT-Xent loss)
- Multi-view consistency (multi-node)
- Sublinear optimization (50→35 subcarrier selection)
- ONNX export with quantization (8-bit, 4-bit, 2-bit)

---

## Appendix: Quick Reference

### File Structure Highlights

```
RuView/
├── README.md                           # Main entry point
├── CHANGELOG.md                        # Release history (v0.5.4 - v0.7.0)
├── docs/
│   ├── adr/                            # 81 Architecture Decision Records
│   ├── ddd/                            # 7 Domain-Driven Design models
│   ├── edge-modules/                   # 65 WASM module specs
│   ├── tutorials/                      # cognitum-seed-pretraining.md
│   ├── build-guide.md                  # Comprehensive build instructions
│   ├── user-guide.md                   # API, hardware, models, training
│   ├── wifi-mat-user-guide.md          # Disaster response system
│   ├── TROUBLESHOOTING.md              # Known issues + fixes
│   └── research/                       # Arena Physica, quantum sensing, RF topological
├── firmware/esp32-csi-node/            # C firmware (ESP-IDF v5.2)
│   ├── main/                           # Main code, CSI callback, WiFi, UDP
│   ├── components/                     # WASM3 runtime
│   ├── CMakeLists.txt
│   └── README.md
├── v1/                                 # Python pipeline (prototyping)
│   ├── src/api/main.py                 # FastAPI server
│   ├── src/sensing/                    # Commodity WiFi (RSSI) sensing
│   ├── data/proof/                     # Verification proof files
│   └── requirements-lock.txt           # Pinned for reproducibility
├── rust-port/wifi-densepose-rs/        # Rust monorepo (production)
│   ├── Cargo.toml                      # Workspace root
│   ├── crates/                         # 15 individual crates
│   ├── scripts/                        # Training, provisioning, WASM build
│   └── README.md
├── ui/
│   ├── viz.html                        # Three.js 3D visualization
│   ├── mobile/                         # Expo React Native app
│   └── pose-fusion/                    # Browser-based pose fusion
├── .github/workflows/                  # CI/CD (firmware, security, testing)
├── docker-compose.yml                  # Dev stack
├── docker-compose.prod.yml             # Production Swarm stack
├── Dockerfile                          # Multi-stage (dev/prod/test/security)
└── examples/
    ├── medical/                        # Medical use cases
    └── happiness-vector/               # Happiness scoring + Seed integration
```

### Command Cheat Sheet

**Verification (no hardware):**
```bash
./verify --verbose --audit
```

**Build Firmware (Docker):**
```bash
docker run --rm -v "$(pwd)/firmware/esp32-csi-node:/project" -w /project \
  espressif/idf:v5.2 bash -c \
  "idf.py set-target esp32s3 && idf.py build"
```

**Flash Firmware:**
```bash
esptool --chip esp32s3 --port COM7 write_flash \
  0x0 bootloader.bin 0x8000 partition-table.bin 0x10000 esp32-csi-node.bin
```

**Provision WiFi:**
```bash
python firmware/esp32-csi-node/provision.py \
  --port COM7 --ssid YourWiFi --password YourPass --target-ip 192.168.1.20
```

**Run Sensing Server (Rust):**
```bash
cargo run --release -p wifi-densepose-sensing-server -- --http-port 3000
```

**Run API Server (Python):**
```bash
uvicorn v1.src.api.main:app --host 0.0.0.0 --port 8000
```

**Bridge to Cognitum Seed:**
```bash
python scripts/seed_csi_bridge.py --token $SEED_TOKEN --udp-port 5006 --validate
```

**Build WASM modules:**
```bash
cd rust-port/wifi-densepose-rs && \
  wasm-pack build crates/wifi-densepose-wasm --target web --release
```

**Run Tests:**
```bash
cd rust-port/wifi-densepose-rs && cargo test --workspace
```

**Docker Dev Stack:**
```bash
docker compose up
# Postgres: localhost:5432, Redis: localhost:6379, API: localhost:8000
```

---

## Knowledge Base Summary

This knowledge base covers:

1. **Architecture**: Physics-based WiFi sensing, signal processing pipeline, domain-driven design
2. **Hardware**: ESP32-S3 boards, flashing, provisioning, multi-node mesh
3. **Firmware**: 4 tiers (raw CSI → signals → vitals → WASM), TDM multi-node protocol
4. **Software**: Python (prototyping), Rust (production), 15-crate workspace
5. **APIs**: REST endpoints, WebSocket streams, RVF model containers
6. **Edge Modules**: 65 WASM modules (medical, security, retail, industrial)
7. **Cognitum Integration**: Seed vector database, witness chains, pretraining pipeline
8. **Training**: Camera-free pose (92.9% accuracy), self-supervised, domain adaptation
9. **Deployment**: Docker (dev/prod), standalone, embedded (Tauri), mobile (Expo)
10. **Operations**: Troubleshooting, known issues, monitoring, logging, CICD
11. **Reference**: 81 ADRs, 7 DDD domain models, CHANGELOG, performance metrics

**For implementation, start with:**
- `/docs/build-guide.md` — build and run options
- `/docs/user-guide.md` — API reference, hardware setup
- `/firmware/esp32-csi-node/README.md` — firmware architecture
- `rust-port/wifi-densepose-rs/README.md` — Rust crate overview
- `/docs/adr/README.md` — decision rationale (80+ ADRs)
