"""fix schema drift: applications.notes + business_contexts privacy-vlaggen

De initiële migratie miste de kolom applications.notes (wel aanwezig in het
ORM-model) en maakte personal_data / special_personal_data nullable terwijl
het model NOT NULL met default false verwacht. De kolom-check maakt deze
migratie ook veilig op databases die de kolom al hebben.

Revision ID: 7f3c9a1d2b4e
Revises: 60ba197cf898
Create Date: 2026-07-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7f3c9a1d2b4e'
down_revision: Union[str, None] = '60ba197cf898'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(insp, table: str, column: str) -> bool:
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    if not _has_column(insp, "applications", "notes"):
        op.add_column("applications", sa.Column("notes", sa.Text(), nullable=True))

    op.execute("UPDATE business_contexts SET personal_data = false WHERE personal_data IS NULL")
    op.execute("UPDATE business_contexts SET special_personal_data = false WHERE special_personal_data IS NULL")
    op.alter_column("business_contexts", "personal_data",
                    nullable=False, server_default=sa.text("false"))
    op.alter_column("business_contexts", "special_personal_data",
                    nullable=False, server_default=sa.text("false"))


def downgrade() -> None:
    op.alter_column("business_contexts", "special_personal_data",
                    nullable=True, server_default=None)
    op.alter_column("business_contexts", "personal_data",
                    nullable=True, server_default=None)
    op.drop_column("applications", "notes")
