"""repos + issues

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-19

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EMBEDDING_DIM = 1536


def upgrade() -> None:
    op.create_table(
        "repos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("github_node_id", sa.String(64), nullable=False, unique=True, index=True),
        sa.Column("name_with_owner", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("description", sa.Text()),
        sa.Column("primary_language", sa.String(64)),
        sa.Column("stargazers_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("forks_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("topics", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column(
            "reputation_score",
            sa.Float(),
            nullable=False,
            server_default="0",
            index=True,
        ),
        sa.Column(
            "is_curated",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
            index=True,
        ),
        sa.Column(
            "is_anti_ai", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column("last_scanned_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "issues",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("github_node_id", sa.String(64), nullable=False, unique=True, index=True),
        sa.Column(
            "repo_id",
            sa.Integer(),
            sa.ForeignKey("repos.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("body", sa.Text()),
        sa.Column("url", sa.String(512), nullable=False),
        sa.Column("state", sa.String(16), nullable=False, index=True),
        sa.Column("labels", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("comments_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "is_good_first_issue",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
            index=True,
        ),
        sa.Column(
            "is_help_wanted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
            index=True,
        ),
        sa.Column("bounty_amount_usd", sa.Float()),
        sa.Column("github_created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("github_updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("embedding", Vector(EMBEDDING_DIM), nullable=False),
        sa.Column(
            "indexed_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_issues_repo_state", "issues", ["repo_id", "state"]
    )


def downgrade() -> None:
    op.drop_index("ix_issues_repo_state", table_name="issues")
    op.drop_table("issues")
    op.drop_table("repos")
