This is a [Next.js](https://nextjs.org) project with a Python FastAPI backend for brand availability checking.

## Architecture

- **Frontend**: Next.js (TypeScript/React) - handles UI and user interactions
- **Backend**: Python FastAPI - handles brand checking logic and API calls to IP Australia

## Getting Started

### Prerequisites

- Node.js and npm
- Python 3.8+

### Setup

1. **Install frontend dependencies:**
```bash
npm install
```

2. **Install backend dependencies:**
```bash
cd backend
pip install -r requirements.txt
cd ..
```

3. **Configure environment variables:**

Create a `.env.local` file in the root directory for Next.js:
```env
BACKEND_URL=http://localhost:8000
```

Create a `.env` file in the `backend/` directory:
```env
# IP Australia API Configuration
IPAU_ENV=test
IPAU_TOKEN_URL_TEST=your_token_url
IPAU_TOKEN_URL_PROD=your_token_url
IPAU_TM_BASE_URL_TEST=your_base_url
IPAU_TM_BASE_URL_PROD=your_base_url
IPAU_CLIENT_ID=your_client_id
IPAU_CLIENT_SECRET=your_client_secret

# Backend Configuration
BACKEND_PORT=8000
```

### Running the Application

You need to run both the backend and frontend:

**Terminal 1 - Start Python backend:**
```bash
cd backend
python main.py
```
The backend will run on `http://localhost:8000`

**Terminal 2 - Start Next.js frontend:**
```bash
npm run dev
```
The frontend will run on `http://localhost:3000`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### API Communication

The Next.js frontend makes requests to `/api/check`, which then forwards the request to the Python backend at `http://localhost:8000/api/check`. The backend handles all brand checking logic including IP Australia API calls.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
