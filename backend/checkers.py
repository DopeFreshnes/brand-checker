"""
Brand checking logic ported from TypeScript.
"""
import os
import re
import time
import asyncio
from typing import Dict, List, Optional, Literal
import httpx
from nice_classes import label_nice_class

AvailabilityStatus = Literal["available", "taken", "unknown", "similar"]


class TrademarkMatch:
    def __init__(
        self,
        id: str,
        words: Optional[str] = None,
        status: Optional[str] = None,
        classes: Optional[List[str]] = None,
        class_labels: Optional[List[str]] = None,
    ):
        self.id = id
        self.words = words
        self.status = status
        self.classes = classes or []
        self.class_labels = class_labels or []

    def to_dict(self):
        return {
            "id": self.id,
            "words": self.words,
            "status": self.status,
            "classes": self.classes,
            "classLabels": self.class_labels,
        }


class CheckResult:
    def __init__(
        self,
        label: str,
        status: AvailabilityStatus,
        summary: Optional[str] = None,
        why_this_matters: Optional[str] = None,
        details: Optional[str] = None,
        exact_matches: Optional[List[TrademarkMatch]] = None,
        similar_matches: Optional[List[TrademarkMatch]] = None,
    ):
        self.label = label
        self.status = status
        self.summary = summary
        self.why_this_matters = why_this_matters
        self.details = details
        self.exact_matches = exact_matches or []
        self.similar_matches = similar_matches or []

    def to_dict(self):
        return {
            "label": self.label,
            "status": self.status,
            "summary": self.summary,
            "whyThisMatters": self.why_this_matters,
            "details": self.details,
            "exactMatches": [m.to_dict() for m in self.exact_matches],
            "similarMatches": [m.to_dict() for m in self.similar_matches],
        }


class AggregatedResults:
    def __init__(
        self,
        business_name: CheckResult,
        trademark: CheckResult,
        domains: List[CheckResult],
        socials: List[CheckResult],
    ):
        self.business_name = business_name
        self.trademark = trademark
        self.domains = domains
        self.socials = socials

    def to_dict(self):
        return {
            "businessName": self.business_name.to_dict(),
            "trademark": self.trademark.to_dict(),
            "domains": [d.to_dict() for d in self.domains],
            "socials": [s.to_dict() for s in self.socials],
        }


def normalize_query(name: str) -> str:
    """Normalize the query string."""
    return re.sub(r"\s+", " ", name.strip())


# OAuth token caching (valid ~1 hour)
_cached_token: Optional[Dict[str, any]] = None
_token_lock = asyncio.Lock()

async def get_ipau_access_token() -> str:
    """Get IP Australia OAuth access token with caching."""
    global _cached_token

    env = os.getenv("IPAU_ENV", "test")

    token_url = (
        os.getenv("IPAU_TOKEN_URL_PROD")
        if env == "production"
        else os.getenv("IPAU_TOKEN_URL_TEST")
    )

    client_id = os.getenv("IPAU_CLIENT_ID")
    client_secret = os.getenv("IPAU_CLIENT_SECRET")

    if not token_url:
        raise ValueError("Missing IPAU_TOKEN_URL_TEST/PROD in environment")
    if not client_id:
        raise ValueError("Missing IPAU_CLIENT_ID in environment")
    if not client_secret:
        raise ValueError("Missing IPAU_CLIENT_SECRET in environment")

    # If we have a valid cached token, reuse it
    if _cached_token and time.time() * 1000 < _cached_token["expiresAt"]:
        return _cached_token["token"]

    # Request new token
    async with _token_lock:
        return await request_new_token()

async def request_new_token() -> str:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            token_url,
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            },
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
        )

        if not response.is_success:
            raise Exception(
                f"Token request failed {response.status_code}: {response.text[:250]}"
            )

        data = response.json()
        access_token = data.get("access_token")
        expires_in = int(data.get("expires_in", 3600))

        if not access_token:
            raise Exception(
                f"Token response missing access_token: {response.text[:250]}"
            )

        # Cache it with a small safety buffer (60s)
        _cached_token = {
            "token": access_token,
            "expiresAt": int(time.time() * 1000) + (expires_in - 60) * 1000,
        }

        return access_token

def extract_nice_classes(tm: Dict) -> List[str]:
    """Extract Nice class numbers from trademark data."""
    candidates = []

    # Direct arrays
    if isinstance(tm.get("classes"), list):
        candidates.extend(tm["classes"])
    if isinstance(tm.get("niceClasses"), list):
        candidates.extend(tm["niceClasses"])
    if isinstance(tm.get("classifications"), list):
        candidates.extend(tm["classifications"])

    # Nested common shapes
    goods_and_services = tm.get("goodsAndServices")
    if isinstance(goods_and_services, dict):
        if isinstance(goods_and_services.get("classes"), list):
            candidates.extend(goods_and_services["classes"])
        if isinstance(goods_and_services.get("niceClasses"), list):
            candidates.extend(goods_and_services["niceClasses"])

    # Sometimes it's goodsAndServices items, each with a class number
    if isinstance(goods_and_services, list):
        candidates.extend(goods_and_services)

    # Sometimes "classifications" is object with list inside
    if isinstance(tm.get("classificationList"), list):
        candidates.extend(tm["classificationList"])

    # Convert to class numbers
    numbers = []
    for c in candidates:
        if isinstance(c, dict):
            num = (
                c.get("number")
                or c.get("classNumber")
                or c.get("niceClass")
                or c.get("class")
                or c.get("classId")
            )
        else:
            num = c

        if num is not None:
            num_str = str(num).strip()
            if num_str:
                numbers.append(num_str)

    # Deduplicate + sort numerically when possible
    unique = sorted(set(numbers), key=lambda x: int(x) if x.isdigit() else 999)

    return unique


async def fetch_trademark_details(
    id: str, token: str, base_url: str
) -> Dict:
    """Fetch detailed trademark information."""
    url = f"{base_url.rstrip('/')}/trade-mark/{id}"

    async with httpx.AsyncClient() as client:
        response = await client.get(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
            },
        )

        if not response.is_success:
            return {
                "id": id,
                "error": f"Detail fetch failed {response.status_code}: {response.text[:120]}",
            }

        try:
            return {"id": id, "data": response.json()}
        except Exception:
            return {
                "id": id,
                "error": f"Detail fetch returned non-JSON: {response.text[:120]}",
            }


async def check_ip_australia_trademark(name: str) -> CheckResult:
    """Check IP Australia trademark availability."""
    q = normalize_query(name)

    env = os.getenv("IPAU_ENV", "test")
    base_url = (
        os.getenv("IPAU_TM_BASE_URL_PROD")
        if env == "production"
        else os.getenv("IPAU_TM_BASE_URL_TEST")
    )

    if not base_url:
        return CheckResult(
            label="Trademark (IP Australia)",
            status="unknown",
            summary="We couldn't run the trademark check right now.",
            why_this_matters="Trademark results help you avoid picking a name that could conflict with an existing brand.",
            details="Missing IPAU_TM_BASE_URL_TEST/PROD in environment",
        )

    url = f"{base_url.rstrip('/')}/search/quick"

    # Matches ApiQuickSearchRequest from the docs
    payload = {
        "query": q,
        "sort": {"field": "NUMBER", "direction": "ASCENDING"},
        "filters": {
            "quickSearchType": ["WORD"],
            "status": ["REGISTERED"],
        },
    }

    try:
        token = await get_ipau_access_token()

        # 1) Quick search
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                json=payload,
            )

            if not response.is_success:
                return CheckResult(
                    label="Trademark (IP Australia)",
                    status="unknown",
                    summary="We couldn't complete the trademark check right now.",
                    why_this_matters="Trademark results help you avoid choosing a name that could conflict with an existing brand.",
                    details=f"IP Australia error {response.status_code}: {response.text[:250]}",
                )

            data = response.json()

        # 2) Parse quick search result
        count = int(data.get("count", 0))
        trademark_ids = data.get("trademarkIds", [])

        if not isinstance(trademark_ids, list):
            trademark_ids = []

        if count == 0 or len(trademark_ids) == 0:
            return CheckResult(
                label="Trademark (IP Australia)",
                status="available",
                summary="No registered word trademarks were found in Australia.",
                why_this_matters="This lowers risk, but it's not a guarantee. Similar marks, pending applications, or other rights may still exist.",
                details="0 registered results returned by IP Australia quick search.",
            )

        # 3) Fetch details for top IDs (so we can show names + classes)
        top_ids = trademark_ids[:5]
        detail_results = await asyncio.gather(
            *[fetch_trademark_details(id, token, base_url) for id in top_ids]
        )

        # 4) Normalize detailed records -> structured matches
        q_lower = q.lower()

        parsed = []
        for d in detail_results:
            if "error" in d:
                parsed.append(
                    TrademarkMatch(
                        id=d["id"],
                        words="",
                        status="",
                        classes=[],
                        class_labels=[],
                    )
                )
                continue

            tm = d["data"]

            # words/name fields vary
            words = (
                tm.get("words")
                or tm.get("tradeMarkWords")
                or tm.get("markText")
                or tm.get("text")
                or tm.get("name")
                or tm.get("tradeMarkName")
                or ""
            )

            # status fields vary
            status = (
                tm.get("statusGroup")
                or tm.get("statusCode")
                or tm.get("statusDetail")
                or tm.get("status")
                or tm.get("tradeMarkStatus")
                or tm.get("state")
                or tm.get("ipRightStatus")
                or ""
            )

            # classes/categories can be nested; try common shapes
            classes_set = set()

            # IP Australia detail shape: goodsAndServices is an array of { class: "35", descriptionText: [...] }
            goods_and_services = tm.get("goodsAndServices")
            if isinstance(goods_and_services, list):
                for gs in goods_and_services:
                    cls = gs.get("class")
                    if cls:
                        classes_set.add(str(cls))

            classes = sorted(classes_set, key=lambda x: int(x) if x.isdigit() else 999)
            class_labels = [label_nice_class(c) for c in classes]

            parsed.append(
                TrademarkMatch(
                    id=d["id"],
                    words=str(words),
                    status=str(status),
                    classes=classes,
                    class_labels=class_labels,
                )
            )

        # Split into exact vs similar
        exact_matches = [
            TrademarkMatch(
                id=p.id,
                words=p.words,
                status=p.status,
                classes=p.classes,
                class_labels=p.class_labels,
            )
            for p in parsed
            if p.words and p.words.lower() == q_lower
        ]

        similar_matches = [
            TrademarkMatch(
                id=p.id,
                words=p.words,
                status=p.status,
                classes=p.classes,
                class_labels=p.class_labels,
            )
            for p in parsed
            if p.words and p.words.lower() != q_lower
        ]

        # If we couldn't parse any details, fall back to IDs only
        any_parsed = len(exact_matches) + len(similar_matches) > 0

        if not any_parsed:
            return CheckResult(
                label="Trademark (IP Australia)",
                status="similar",
                summary="Registered trademarks exist with this name or something similar.",
                why_this_matters="Even if names aren't identical, similar marks in related categories can increase legal and branding risk.",
                details=f"Found {count} registered match(es). IDs: {', '.join(trademark_ids[:5])}",
                similar_matches=[
                    TrademarkMatch(id=id) for id in trademark_ids[:5]
                ],
            )

        is_taken = len(exact_matches) > 0

        return CheckResult(
            label="Trademark (IP Australia)",
            status="taken" if is_taken else "similar",
            summary="An identical registered trademark exists in Australia."
            if is_taken
            else "Similar registered trademarks exist in Australia.",
            why_this_matters="Using the same name can create a high risk of trademark conflict, especially in related industries."
            if is_taken
            else "Even if names aren't identical, similar marks in related categories can still cause legal and branding risk.",
            details=f"Found {count} registered match(es). Showing the top {len(top_ids)}.",
            exact_matches=exact_matches,
            similar_matches=similar_matches,
        )

    except Exception as err:
        return CheckResult(
            label="Trademark (IP Australia)",
            status="unknown",
            summary="We couldn't run the trademark check right now.",
            why_this_matters="Trademark results help you avoid choosing a name that could conflict with an existing brand.",
            details=f"Request failed: {str(err)}",
        )


async def get_demo_results(name: str) -> AggregatedResults:
    """Get aggregated brand checking results (MVP with demo data)."""
    normalized = name.lower().strip()
    compact = normalized.replace(" ", "")

    # Demo logic (keep for now)
    is_probably_taken = "koala" in normalized or "australia" in normalized
    has_similar = "brew" in normalized or "coffee" in normalized

    # Real trademark check
    trademark = await check_ip_australia_trademark(name)

    return AggregatedResults(
        business_name=CheckResult(
            label="ASIC business name (AU)",
            status="taken" if is_probably_taken else "available",
            details="A similar or identical business name appears to exist (demo)."
            if is_probably_taken
            else "No exact match found (demo).",
        ),
        trademark=trademark,
        domains=[
            CheckResult(
                label=f"{compact}.com",
                status="taken" if is_probably_taken else "available",
                details="Likely registered already (demo)."
                if is_probably_taken
                else "Appears free (demo).",
            ),
            CheckResult(
                label=f"{compact}.com.au",
                status="similar" if has_similar else "available",
                details="Similar domains may exist (demo)."
                if has_similar
                else "Appears free (demo).",
            ),
        ],
        socials=[
            CheckResult(
                label=f"@{compact} (Instagram)",
                status="taken" if is_probably_taken else "available",
                details="Handle looks popular (demo)."
                if is_probably_taken
                else "Appears free (demo).",
            ),
            CheckResult(
                label=f"@{compact} (TikTok)",
                status="available",
                details="Appears free (demo).",
            ),
        ],
    )
