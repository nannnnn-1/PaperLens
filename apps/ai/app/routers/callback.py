"""Endpoint to receive callbacks from Nest.js (ack/log only)."""

from fastapi import APIRouter

from app.schemas import ApiResponse, ParseCallbackAck, ParseCallbackPayload

router = APIRouter(tags=["callback"])


@router.post("/parse/callback", response_model=ApiResponse)
async def receive_callback(req: ParseCallbackPayload) -> ApiResponse:
    """Receive a callback from Nest.js and acknowledge it."""
    return ApiResponse(
        data=ParseCallbackAck(received=True),
    )
