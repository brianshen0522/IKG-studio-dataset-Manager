# IKG studio dataset Manager

A web-based manager for running multiple FiftyOne instances with YOLO dataset support and IoU-based duplicate detection.

## Features

- **Web UI**: Manage multiple FiftyOne instances through a clean, modern web interface
- **Process Management**: Uses PM2 to manage Python processes reliably
- **Docker Support**: Single container deployment with MongoDB
- **Port Management**: Configurable port ranges with validation
- **IoU-Based Duplicate Detection**: Intelligent duplicate detection using bounding box comparison
- **Instance Control**: Start, stop, restart instances with real-time health monitoring
- **Log Viewing**: View logs for each instance directly in the UI
- **Subfolder Dataset Discovery**: Automatically finds valid datasets in nested directories
- **Integrated Label Editor**: Edit YOLO annotations directly from FiftyOne - fix mistakes without leaving your workflow

## Quick Start

### 1. Configuration

Copy the example environment file and configure:

```bash
cp .env.example .env
```

Edit `.env` to set your preferences:

```env
DATASET_BASE_PATH=/data/datasets
PORT_START=5151
PORT_END=5160
MANAGER_PORT=3000
DEFAULT_IOU_THRESHOLD=0.8
DEFAULT_DEBUG_MODE=false
DATABASE_URL=postgres://postgres:postgres@postgres:5432/fiftyone_manager
```

### 2. Run with Docker

#### Production Environment

Build and start the container:

```bash
docker compose up -d
```

Access the manager at `http://localhost:3000`

### 2a. Migrate Existing Instances

If you previously used file-based instances (instances.json), migrate them to PostgreSQL:

```bash
node scripts/migrate-to-postgres.js
```

### 3. Run Locally (without Docker)

Install dependencies:

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
pip install fiftyone opencv-python-headless numpy pymongo

# Install PM2 globally
npm install -g pm2
```

Start the server:

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Using the Manager

### Add a New Instance

1. Click "Add Instance" in the web UI
2. Fill in the details:
   - **Name**: Unique identifier (alphanumeric, hyphens, underscores only)
   - **Port**: Port number within your configured range
   - **Dataset Path**: Select from dropdown or enter path containing `images/` and `labels/` folders
   - **Threshold**: IoU threshold for duplicate detection (0.0 - 1.0, default: 0.8)
   - **Debug Mode**: Enable to organize duplicates into separate folders
3. Click "Save Instance"

### Manage Instances

- **Start**: Launch a FiftyOne instance
- **Stop**: Stop a running instance
- **Restart**: Restart an instance
- **Open**: Open the FiftyOne UI in a new tab
- **Logs**: View instance logs in real-time
- **Edit**: Modify instance settings (only when stopped)
- **Remove**: Delete an instance (only when stopped)

### Dataset Discovery

The manager automatically scans for valid datasets (folders containing both `images/` and `labels/` subdirectories) up to 5 levels deep within your base path. Subfolders are displayed in the dataset picker dropdown.

**Example structure:**
```
/data/datasets/
  ├── project1/
  │   ├── dataset_a/
  │   │   ├── images/
  │   │   └── labels/
  │   └── dataset_b/
  │       ├── images/
  │       └── labels/
  └── project2/
      └── dataset_c/
          ├── images/
          └── labels/
```

You'll see: `project1/dataset_a`, `project1/dataset_b`, `project2/dataset_c`

### Dataset Structure

Your datasets should follow this structure:

```
dataset_path/
├── images/
│   ├── image1.jpg
│   ├── image2.jpg
│   └── ...
└── labels/
    ├── image1.txt
    ├── image2.txt
    └── ...
```

Label files use YOLO format (normalized coordinates 0.0-1.0):
```
<class_id> <x_center> <y_center> <width> <height>
```

## Configuration Options

### Environment Files

The project uses a single environment configuration file:

- **`.env.example`**: Template file with all available configuration options
- **`.env`**: Environment configuration (copy from `.env.example`)

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATASET_BASE_PATH` | Base directory for datasets | `/data/datasets` |
| `PORT_START` | Starting port for instances | `5151` |
| `PORT_END` | Ending port for instances | `5160` |
| `MANAGER_PORT` | Port for the manager web UI | `3000` |
| `DEFAULT_IOU_THRESHOLD` | Default IoU threshold (0.0-1.0) | `0.8` |
| `DEFAULT_DEBUG_MODE` | Default debug mode setting | `false` |
| `VIEWER_IMAGE_LOADING_BATCH_COUNT` | Viewer max concurrent thumbnail loads on open | `200` |
| `HEALTH_CHECK_INTERVAL` | Health check frequency (ms) | `5000` |
| `HEALTH_CHECK_TIMEOUT` | Health check timeout (ms) | `3000` |
| `FIFTYONE_DATABASE_URI` | MongoDB connection URI | `mongodb://mongodb:27017` |
| `DATABASE_URL` | PostgreSQL connection URL | `postgres://postgres:postgres@postgres:5432/fiftyone_manager` |

### Docker Compose Volumes

- `${DATASET_BASE_PATH}:/data/datasets` - Mount your datasets directory
- `pm2-logs:/root/.pm2/logs` - Persist PM2 logs
- `mongodb-data:/data/db` - Persist MongoDB data
- `./postgres-data:/var/lib/postgresql/data` - Persist PostgreSQL data

## Duplicate Detection

The duplicate detection feature uses **IoU (Intersection over Union)** to compare YOLO bounding box labels:

### How It Works

1. **Parse Labels**: Reads YOLO format label files for each image
2. **Sequential Comparison**: Compares images in filename order (chronological)
3. **Similarity Criteria**:
   - Same number of objects
   - Same class IDs (when sorted)
   - All bounding boxes have IoU ≥ threshold
4. **Greedy Matching**: For multiple objects of the same class, uses greedy algorithm to find best box pairings
5. **Move Duplicates**: Moves similar images to `duplicate/images` and `duplicate/labels`
6. **Debug Mode**: Organizes duplicates into separate group folders for inspection

### IoU Calculation

```
IoU = Intersection Area / Union Area
```

- **Intersection**: Overlapping area of two bounding boxes
- **Union**: Total area covered by both boxes

### Example

Two images are considered duplicates if:
- Both have 2 objects
- Both have classes [2, 5]
- Box for class 2: IoU ≥ 0.8
- Box for class 5: IoU ≥ 0.8

## API Endpoints

The manager provides a REST API:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/config` | Get manager configuration |
| `GET` | `/api/datasets` | List valid datasets (recursive) |
| `GET` | `/api/instances` | List all instances with status |
| `POST` | `/api/instances` | Create new instance |
| `PUT` | `/api/instances/:name` | Update instance |
| `DELETE` | `/api/instances/:name` | Delete instance |
| `POST` | `/api/instances/:name/start` | Start instance |
| `POST` | `/api/instances/:name/stop` | Stop instance |
| `POST` | `/api/instances/:name/restart` | Restart instance |
| `GET` | `/api/instances/:name/logs` | Get instance logs |

## Validation Rules

- Instance names must be unique and alphanumeric (plus hyphens/underscores)
- Ports must be unique across instances
- Ports must be within the configured range
- Running instances cannot be edited or deleted (must stop first)
- IoU thresholds must be between 0.0 and 1.0
- Dataset paths must contain `images/` and `labels/` subdirectories

## Health Monitoring

Each running instance is monitored for:
- **PM2 Process Status**: Whether the process is running
- **Service Health**: HTTP health check on the FiftyOne port
- **Status Indicators**:
  - Green: Running and healthy
  - Red: Process running but service unreachable
  - Gray: Process stopped

## Troubleshooting

### Instance won't start

- Check that the dataset path exists and contains `images/` and `labels/` folders
- Verify the port is not already in use by another application
- Check the logs for error messages
- Ensure MongoDB is running (required for FiftyOne)

### Cannot access FiftyOne UI

- Ensure the port is exposed in docker-compose.yml (ports: `${PORT_START}-${PORT_END}`)
- Verify the instance status is "Running" and service health is "Service OK"
- Check firewall settings
- Try accessing via `http://localhost:<port>` instead of hostname

### Datasets not appearing in dropdown

- Verify `DATASET_BASE_PATH` is correct in `.env`
- Ensure folders contain both `images/` and `labels/` subdirectories
- Click "Refresh" button in the dataset picker
- Check server logs for scanning errors

### PM2 issues

View all PM2 processes:
```bash
pm2 list
```

View logs for a specific instance:
```bash
pm2 logs <instance-name>
```

Reset PM2 (stops all processes):
```bash
pm2 kill
```

Restart PM2 daemon:
```bash
pm2 resurrect
```

## Running Production and Development Together

Both environments can run simultaneously on the same server without conflicts:

### Start both environments:
```bash
# Start production
docker compose up -d

# Start development
docker compose -f docker-compose.dev.yml --env-file .env.dev up -d
```

### View running containers:
```bash
docker ps
```

You should see:
- `fiftyone-mongodb` (prod) on port 27017
- `fiftyone-mongodb-dev` (dev) on port 27018
- `fiftyone-manager_v3` (prod) on port 3000
- `fiftyone-manager_v3-dev` (dev) on port 3001

### Stop environments individually:
```bash
# Stop production
docker compose down

# Stop development
docker compose -f docker-compose.dev.yml down
```

### View logs:
```bash
# Production logs
docker compose logs -f

# Development logs
docker compose -f docker-compose.dev.yml logs -f
```

## Manual Script Usage

You can run the FiftyOne script directly without the manager:

```bash
python start_fiftyone.py <port> <dataset_path> [--iou-threshold 0.8] [--debug]
```

**Arguments:**
- `port`: Port number to run FiftyOne on
- `dataset_path`: Path to dataset folder
- `--iou-threshold`: IoU threshold for duplicate detection (0.0-1.0)
- `--debug`: Enable debug mode (organize duplicates into groups)

**Example:**
```bash
python start_fiftyone.py 5151 /data/datasets/my-dataset --iou-threshold 0.85 --debug
```

## Class Labels

The dataset supports these YOLO class IDs (0-6):
- 0: `one`
- 1: `two`
- 2: `three`
- 3: `four`
- 4: `five`
- 5: `six`
- 6: `invalid`

## Architecture

```
Web Browser
    ├─→ React-like UI (Vanilla JS)
    │
    ├─→ Express REST API (Node.js)
    │     ├─→ Instance Management
    │     ├─→ Dataset Discovery
    │     └─→ PM2 Process Control
    │
    └─→ PM2 Process Manager
          ├─→ Python Workers (start_fiftyone.py)
          │     ├─→ IoU Duplicate Detection
          │     ├─→ Dataset Loading
          │     └─→ FiftyOne App Launch
          │
          └─→ MongoDB (FiftyOne Database)
```

## Label Editor Integration

The integrated label editor allows you to fix label mistakes directly from FiftyOne without switching to external tools.

### Quick Usage

1. **Find a mistake** in FiftyOne
2. **Select the image**
3. **Press backtick (`)** or click the operator button
4. **Search for "Edit Label in Tool"**
5. **Edit labels** in the web-based editor
6. **Save changes**
7. **Refresh FiftyOne** to see updates

### Features

- **Create labels**: Draw new bounding boxes
- **Delete labels**: Remove incorrect annotations
- **Reclass labels**: Change object classes
- **Edit boxes**: Resize and reposition bounding boxes
- **Real-time preview**: See changes instantly
- **YOLO format**: Saves directly to .txt label files

### Detailed Guide

See [LABEL_EDITOR_GUIDE.md](LABEL_EDITOR_GUIDE.md) for:
- Step-by-step instructions
- Keyboard shortcuts
- Troubleshooting tips
- Advanced usage

## Contributors

This project was developed by:

- [@ikigia-steve-s](https://github.com/ikigia-steve-s)
- [@ikigia-ella-l](https://github.com/ikigia-ella-l)
- [@ikigai-aleistar-c](https://github.com/ikigai-aleistar-c)

## License

MIT
