"""resize embedding columns to voyage 1024-dim

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-19

All embeddings prior to this migration were zero-vector placeholders, so
we truncate both tables and recreate the columns at the new dimension
rather than write a dim-preserving type cast.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_DIM = 1024
OLD_DIM = 1536


def upgrade() -> None:
    # Issues FK-cascade from repos; truncating issues alone is enough for
    # issue embeddings. Skill profiles are per-user and safe to wipe — users
    # can re-run POST /users/me/profile/refresh.
    op.execute("TRUNCATE TABLE issues RESTART IDENTITY CASCADE")
    op.execute("TRUNCATE TABLE skill_profiles RESTART IDENTITY CASCADE")

    op.drop_column("skill_profiles", "embedding")
    op.add_column(
        "skill_profiles",
        sa.Column("embedding", Vector(NEW_DIM), nullable=False),
    )

    op.drop_column("issues", "embedding")
    op.add_column(
        "issues",
        sa.Column("embedding", Vector(NEW_DIM), nullable=False),
    )


def downgrade() -> None:
    op.execute("TRUNCATE TABLE issues RESTART IDENTITY CASCADE")
    op.execute("TRUNCATE TABLE skill_profiles RESTART IDENTITY CASCADE")

    op.drop_column("issues", "embedding")
    op.add_column(
        "issues",
        sa.Column("embedding", Vector(OLD_DIM), nullable=False),
    )

    op.drop_column("skill_profiles", "embedding")
    op.add_column(
        "skill_profiles",
        sa.Column("embedding", Vector(OLD_DIM), nullable=False),
    )
