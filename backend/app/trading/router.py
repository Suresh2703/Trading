from fastapi import APIRouter

router = APIRouter(
    prefix="/trading",
    tags=["trading"],
)

@router.get("/")
def get_trading_status():
    return {"message": "Trading module active"}
