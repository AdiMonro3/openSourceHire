"""contact_messages

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-20
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "contact_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "to_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("from_name", sa.String(128), nullable=False),
        sa.Column("from_email", sa.String(254), nullable=False),
        sa.Column("from_company", sa.String(128)),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("ip", sa.String(64)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_contact_messages_to_user_id",
        "contact_messages",
        ["to_user_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_contact_messages_to_user_id", table_name="contact_messages"
    )
    op.drop_table("contact_messages")
