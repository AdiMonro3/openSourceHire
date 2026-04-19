from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

EMBEDDING_DIM = 1024


class Issue(Base):
    __tablename__ = "issues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    github_node_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    repo_id: Mapped[int] = mapped_column(
        ForeignKey("repos.id", ondelete="CASCADE"), index=True
    )
    number: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(512))
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    url: Mapped[str] = mapped_column(String(512))
    state: Mapped[str] = mapped_column(String(16), index=True)
    labels: Mapped[list[str]] = mapped_column(JSON, default=list)
    comments_count: Mapped[int] = mapped_column(Integer, default=0)
    is_good_first_issue: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_help_wanted: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    bounty_amount_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    github_created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    github_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIM))
    indexed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    repo: Mapped["Repo"] = relationship(back_populates="issues")  # noqa: F821
