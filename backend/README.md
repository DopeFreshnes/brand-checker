# Brand Checker Python Backend

Python FastAPI backend for brand availability checking.

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Create a `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Update `.env` with your IP Australia API credentials.

## Running the Backend

### Development
```bash
python main.py
```

Or with uvicorn directly:
```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

### API Endpoints

- `GET /` - API info
- `GET /health` - Health check
- `POST /api/check` - Check brand availability
  - Request body: `{ "name": "Brand Name" }`
  - Response: `{ "success": true, "results": {...} }`

## Integration with Next.js Frontend

The Next.js frontend is configured to call this backend via the `BACKEND_URL` environment variable (defaults to `http://localhost:8000`).

Make sure both services are running:
1. Start the Python backend: `python backend/main.py`
2. Start the Next.js frontend: `npm run dev`
