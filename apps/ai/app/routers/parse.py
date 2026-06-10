from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

router = APIRouter(tags=["parse"])


class ParseRequest(BaseModel):
    paper_id: str
    file_url: str


class ParseResponse(BaseModel):
    job_id: str
    status: str


@router.post("/parse", response_model=ParseResponse)
async def submit_parse(req: ParseRequest):
    """提交 PDF 解析任务"""
    # TODO: 生成 job_id，写入 Redis List，由后台 worker 消费
    return ParseResponse(job_id="job_dummy", status="queued")


@router.get("/parse/{job_id}")
async def get_parse_status(job_id: str):
    """查询解析状态"""
    # TODO: 查询任务状态
    return {"job_id": job_id, "status": "queued"}
