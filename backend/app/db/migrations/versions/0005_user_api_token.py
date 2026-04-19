"""add api_token column to users for CLI auth

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-19
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("api_token", sa.String(length=64), nullable=True),
    )
    op.create_index(
        "ix_users_api_token",
        "users",
        ["api_token"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_users_api_token", table_name="users")
    op.drop_column("users", "api_token")
