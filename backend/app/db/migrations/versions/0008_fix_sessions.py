"""fix_sessions + fix_files

Revision ID: 0008
Revises: 0007
Create Date: 2026-04-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "fix_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "issue_id",
            sa.Integer(),
            sa.ForeignKey("issues.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("upstream_repo", sa.String(255), nullable=False),
        sa.Column("upstream_default_branch", sa.String(128), nullable=False),
        sa.Column("base_sha", sa.String(40), nullable=False),
        sa.Column("fork_full_name", sa.String(255)),
        sa.Column("branch_name", sa.String(128)),
        sa.Column("state", sa.String(16), nullable=False, server_default="draft"),
        sa.Column("pr_url", sa.String(512)),
        sa.Column("pr_number", sa.Integer()),
        sa.Column("last_error", sa.Text()),
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
    op.create_index("ix_fix_sessions_user_id", "fix_sessions", ["user_id"])
    op.create_index("ix_fix_sessions_issue_id", "fix_sessions", ["issue_id"])
    op.create_index("ix_fix_sessions_state", "fix_sessions", ["state"])

    op.create_table(
        "fix_files",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "session_id",
            sa.Integer(),
            sa.ForeignKey("fix_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("path", sa.String(512), nullable=False),
        sa.Column("original_blob_sha", sa.String(40), nullable=False),
        sa.Column("original_text", sa.Text(), nullable=False),
        sa.Column("draft_text", sa.Text()),
        sa.Column(
            "is_ai_assisted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("ai_summary_of_change", sa.String(120)),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
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
        sa.UniqueConstraint("session_id", "path", name="uq_fix_files_session_path"),
    )
    op.create_index("ix_fix_files_session_id", "fix_files", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_fix_files_session_id", table_name="fix_files")
    op.drop_table("fix_files")
    op.drop_index("ix_fix_sessions_state", table_name="fix_sessions")
    op.drop_index("ix_fix_sessions_issue_id", table_name="fix_sessions")
    op.drop_index("ix_fix_sessions_user_id", table_name="fix_sessions")
    op.drop_table("fix_sessions")
