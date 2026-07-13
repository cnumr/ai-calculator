from pydantic import BaseModel


class ProviderModelOut(BaseModel):
    provider: str
    name: str
