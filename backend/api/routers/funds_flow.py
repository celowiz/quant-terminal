from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import logging


router = APIRouter()


class FundsFlowRow(BaseModel):
	class_name: str
	day: Optional[float] = None
	month: Optional[float] = None
	year: Optional[float] = None
	twelve_months: Optional[float] = None


class FundsFlowResponse(BaseModel):
	data_ref: str
	rows: List[FundsFlowRow]


@router.get("/funds_flow", response_model=FundsFlowResponse)
def get_funds_flow():
	try:
		logging.getLogger("api").info("GET /funds_flow - start")
		# Import lazy para evitar carregar dependências pesadas no startup
		from ...utils.anbima_funds_flow import get_funds_flow_series
		data = get_funds_flow_series()
		logging.getLogger("api").info("GET /funds_flow - success")
		return data
	except Exception as e:
		logging.getLogger("api").exception("GET /funds_flow - error: %s", e)
		raise HTTPException(status_code=500, detail=str(e))


