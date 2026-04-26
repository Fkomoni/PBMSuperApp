from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from typing import Optional

from app.core.security import get_current_user
from app.seed import ENROLLEES

router = APIRouter(tags=["enrollees"])


class CommentBody(BaseModel):
    text: str
    author: Optional[str] = None


@router.get("/enrollees")
def list_enrollees(
    region: Optional[str] = Query(None, description="Filter by region"),
    current_user: dict = Depends(get_current_user),
):
    data = ENROLLEES
    if region:
        data = [e for e in data if e["region"].lower() == region.lower()]
    # Strip comments from list view for brevity
    return [
        {k: v for k, v in e.items() if k != "comments"}
        for e in data
    ]


@router.get("/enrollees/{enrollee_id}")
def get_enrollee(
    enrollee_id: str,
    current_user: dict = Depends(get_current_user),
):
    enrollee = next((e for e in ENROLLEES if e["id"] == enrollee_id), None)
    if not enrollee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollee not found.")
    return enrollee


@router.post("/enrollees/{enrollee_id}/comment")
def add_comment(
    enrollee_id: str,
    body: CommentBody,
    current_user: dict = Depends(get_current_user),
):
    enrollee = next((e for e in ENROLLEES if e["id"] == enrollee_id), None)
    if not enrollee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollee not found.")
    comment = {
        "author": body.author or current_user["email"],
        "text": body.text,
        "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
    }
    enrollee["comments"].append(comment)
    return {"message": "Comment added.", "comment": comment}
