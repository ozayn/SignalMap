"""Event schema for contextual anchors in discourse analysis."""

from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class EventType(str, Enum):
    POLITICAL = "political"
    SOCIAL = "social"
    MEDIA = "media"
    CULTURAL = "cultural"
    PLATFORM = "platform"
    MILITARY = "military"


class EventConfidence(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Event(BaseModel):
    """Exogenous context event; not an engagement metric.
    Point events: date (required).
    Range events: date_start and date_end (required), date optional.
    """

    id: str
    title: str
    date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="ISO date for point events")
    date_start: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="Start date for range events")
    date_end: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="End date for range events")
    type: EventType
    description: str = Field(..., max_length=500)
    sources: list[str] = Field(default_factory=list, max_length=10)
    confidence: Literal["high", "medium", "low"] = "high"

    @model_validator(mode="after")
    def date_or_range(self) -> "Event":
        has_point = self.date is not None
        has_range = self.date_start is not None and self.date_end is not None
        if not has_point and not has_range:
            raise ValueError("Event must have date (point) or date_start and date_end (range)")
        if (self.date_start is None) != (self.date_end is None):
            raise ValueError("date_start and date_end must both be provided for range events")
        return self
