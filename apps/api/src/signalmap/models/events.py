"""Event schema for contextual anchors in discourse analysis."""

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class EventType(str, Enum):
    POLITICAL = "political"
    SOCIAL = "social"
    MEDIA = "media"
    CULTURAL = "cultural"
    PLATFORM = "platform"


class EventConfidence(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Event(BaseModel):
    """Exogenous context event; not an engagement metric."""

    id: str
    title: str
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$", description="ISO date YYYY-MM-DD")
    type: EventType
    description: str = Field(..., max_length=500)
    sources: list[str] = Field(default_factory=list, max_length=10)
    confidence: Literal["high", "medium", "low"] = "high"
