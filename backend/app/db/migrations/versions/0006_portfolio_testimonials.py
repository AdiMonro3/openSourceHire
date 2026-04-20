"""portfolios + testimonials

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-20
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "portfolios",
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id"),
            primary_key=True,
        ),
        sa.Column("narrative", sa.JSON(), nullable=False),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_table(
        "testimonials",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "to_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("from_name", sa.String(128), nullable=False),
        sa.Column("from_role", sa.String(128)),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "approved",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_testimonials_to_user_id",
        "testimonials",
        ["to_user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_testimonials_to_user_id", table_name="testimonials")
    op.drop_table("testimonials")
    op.drop_table("portfolios")
