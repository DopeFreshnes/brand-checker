from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Literal
import os
from dotenv import load_dotenv

from checkers import get_demo_results

# Load environment variables
load_dotenv()

app = FastAPI(title="Brand Checker API", version="1.0.0")

# Configure CORS to allow Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Next.js dev server
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CheckRequest(BaseModel):
    name: str


class TrademarkMatch(BaseModel):
    id: str
    words: Optional[str] = None
    status: Optional[str] = None
    classes: Optional[List[str]] = None
    classLabels: Optional[List[str]] = None


class CheckResult(BaseModel):
    label: str
    status: Literal["available", "taken", "unknown", "similar"]
    summary: Optional[str] = None
    whyThisMatters: Optional[str] = None
    details: Optional[str] = None
    exactMatches: Optional[List[TrademarkMatch]] = None
    similarMatches: Optional[List[TrademarkMatch]] = None


class AggregatedResults(BaseModel):
    businessName: CheckResult
    trademark: CheckResult
    domains: List[CheckResult]
    socials: List[CheckResult]


class CheckResponse(BaseModel):
    success: bool
    results: Optional[AggregatedResults] = None
    error: Optional[str] = None


@app.get("/")
async def root():
    return {"message": "Brand Checker API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.post("/api/check", response_model=CheckResponse)
async def check_brand(request: CheckRequest):
    """
    Check brand availability across multiple sources.
    """
    try:
        name = (request.name or "").strip()
        
        if not name:
            raise HTTPException(
                status_code=400,
                detail="No name provided."
            )
        
        results = await get_demo_results(name)
        
        # Convert AggregatedResults to dict format
        results_dict = results.to_dict()
        
        return CheckResponse(
            success=True,
            results=AggregatedResults(**results_dict)
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in /api/check: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("BACKEND_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
