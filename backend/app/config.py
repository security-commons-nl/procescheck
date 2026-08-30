from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    cors_origins: str = "http://localhost:3300"

    # Azure AD — leeg betekent authenticatie uitgeschakeld (dev-mode)
    azure_tenant_id: str = ""
    azure_client_id: str = ""

    # Rolgebaseerde autorisatie. Uit (default) = iedere ingelogde gebruiker
    # mag alles (bestaand gedrag). Aan = de rollen uit de Azure AD
    # roles-claim worden afgedwongen: lezer / redacteur / beheerder.
    rbac_enforced: bool = False

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    @property
    def auth_enabled(self) -> bool:
        return bool(self.azure_tenant_id and self.azure_client_id)

    class Config:
        env_file = ".env"


settings = Settings()
