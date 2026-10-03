from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.schemas.auth_schema import HookRequest
from app.services.hook_service import generate_hook
from app.routers import auth
from app.database.database import Base, engine
from app.models.user import User 
from app.config import ALLOW_ORIGINS
from app.routers import history

app = FastAPI()
Base.metadata.create_all(bind=engine)
app.include_router(auth.router)
app.include_router(history.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.get("/")
def root():
    return {"messeage": "Hook generator API is running!"}


@app.post("/generate")
def generate(request: HookRequest):
    hook = generate_hook(
        request.description,
        request.platform, 
        request.tone, 
        request.language,
        request.previous_hooks
        )
    return {
        "hooks": hook
        }



