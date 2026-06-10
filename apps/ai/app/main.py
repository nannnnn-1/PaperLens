from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import parse, chat

app = FastAPI(
    title="PaperLens AI Service",
    description="PDF parsing, LLM agents, embeddings",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(parse.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "ok"}
