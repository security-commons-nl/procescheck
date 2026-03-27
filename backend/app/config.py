from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://procescheck:procescheck_dev@localhost:5435/procescheck"
    cors_origins: str = "http://localhost:3300"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()
