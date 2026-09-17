from pydantic import BaseModel, ConfigDict

class HookRequest(BaseModel):
    description : str
    platform : str
    tone : str
    language: str
    previous_hooks: list[str] | None = None

class UserSignup(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    model_config = ConfigDict(from_attributes=True)

class HistoryCreate(BaseModel):
    description : str
    platform : str
    tone : str
    language : str
    hooks : list[str]