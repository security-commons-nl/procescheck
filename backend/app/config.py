from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://procescheck:procescheck_dev@localhost:5435/procescheck"
    cors_origins: str = "http://localhost:3300"

    # Azure AD — leeg betekent authenticatie uitgeschakeld (dev-mode)
    azure_tenant_id: str = ""
    azure_client_id: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    @property
    def auth_enabled(self) -> bool:
        return bool(self.azure_tenant_id and self.azure_client_id)

    class Config:
        env_file = ".env"


settings = Settings()
