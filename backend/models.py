import uuid
from datetime import datetime, date
from sqlalchemy import (
    Column, String, Integer, Boolean, Float, Text, DateTime, JSON, ForeignKey, UniqueConstraint,
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


def _uuid():
    return str(uuid.uuid4())


def _today():
    return date.today().isoformat()


class Book(Base):
    __tablename__ = "books"

    id            = Column(String, primary_key=True, default=_uuid)
    user_id       = Column(String, nullable=False, index=True)
    title         = Column(String, nullable=False)
    filename      = Column(String, nullable=False)
    storage_path  = Column(String, nullable=False)
    total_pages   = Column(Integer, default=0)
    dominant_level = Column(String)
    file_type     = Column(String, default="pdf", nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)

    words         = relationship("Word", back_populates="book", passive_deletes=True)
    grammar_notes = relationship("GrammarNote", back_populates="book", passive_deletes=True)


class Word(Base):
    __tablename__ = "words"

    id           = Column(String, primary_key=True, default=_uuid)
    user_id      = Column(String, nullable=False, index=True)
    book_id      = Column(String, ForeignKey("books.id", ondelete="SET NULL"), nullable=True)
    source_page  = Column(Integer)
    german       = Column(String, nullable=False)
    word_type    = Column(String)
    gender       = Column(String)
    cefr_level   = Column(String)
    english      = Column(Text)
    persian      = Column(Text)
    example_de   = Column(Text)
    example_en   = Column(Text)
    example_fa   = Column(Text)
    extra_info   = Column(JSON, default=dict)
    confidence   = Column(Integer, default=0)
    interval_days = Column(Integer, default=1)
    easiness     = Column(Float, default=2.5)
    next_review  = Column(String, default=_today)
    seen_count   = Column(Integer, default=0)
    created_at   = Column(DateTime, default=datetime.utcnow)

    book = relationship("Book", back_populates="words")


class GrammarRule(Base):
    __tablename__ = "grammar_rules"

    id                  = Column(String, primary_key=True, default=_uuid)
    name                = Column(String, nullable=False, unique=True)
    pattern             = Column(String)
    cefr_level          = Column(String, nullable=False, index=True)
    english_explanation = Column(Text)
    persian_explanation = Column(Text)
    example_de          = Column(Text)
    example_en          = Column(Text)
    example_fa          = Column(Text)
    translations        = Column(JSON, default=dict)
    prerequisites       = Column(JSON, default=list)
    created_at          = Column(DateTime, default=datetime.utcnow)

    mastery = relationship("GrammarMastery", back_populates="rule", cascade="all, delete-orphan")
    notes   = relationship("GrammarNote",    back_populates="rule")


class GrammarMastery(Base):
    __tablename__ = "grammar_mastery"

    id             = Column(String, primary_key=True, default=_uuid)
    user_id        = Column(String, nullable=False, index=True)
    rule_id        = Column(String, ForeignKey("grammar_rules.id", ondelete="CASCADE"))
    attempts       = Column(Integer, default=0)
    correct        = Column(Integer, default=0)
    mastered       = Column(Boolean, default=False)
    last_practiced = Column(DateTime)

    rule = relationship("GrammarRule", back_populates="mastery")


class GrammarNote(Base):
    __tablename__ = "grammar_notes"

    id                  = Column(String, primary_key=True, default=_uuid)
    user_id             = Column(String, nullable=False, index=True)
    rule_id             = Column(String, ForeignKey("grammar_rules.id", ondelete="SET NULL"), nullable=True)
    book_id             = Column(String, ForeignKey("books.id",         ondelete="SET NULL"), nullable=True)
    source_page         = Column(Integer)
    raw_text            = Column(Text, nullable=False)
    cefr_level          = Column(String)
    english_explanation = Column(Text)
    persian_explanation = Column(Text)
    example_de          = Column(Text)
    created_at          = Column(DateTime, default=datetime.utcnow)

    book = relationship("Book",        back_populates="grammar_notes")
    rule = relationship("GrammarRule", back_populates="notes")


class Scenario(Base):
    __tablename__ = "scenarios"

    id               = Column(String, primary_key=True, default=_uuid)
    name             = Column(String, nullable=False)
    description      = Column(Text)
    cefr_level       = Column(String)
    goal             = Column(Text)
    persona          = Column(Text)
    persona_de       = Column(Text)
    avatar_emoji     = Column(String, default="🧑")
    subject          = Column(String, nullable=True)
    scenario_type    = Column(String, nullable=True)
    opening_message  = Column(String, nullable=True)

    sessions = relationship("ChatSession", back_populates="scenario")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id          = Column(String, primary_key=True, default=_uuid)
    user_id     = Column(String, nullable=False, index=True)
    scenario_id = Column(String, ForeignKey("scenarios.id", ondelete="SET NULL"), nullable=True)
    context     = Column(String)
    context_ref = Column(String)
    transcript  = Column(JSON, default=list)
    summary     = Column(Text)
    completed   = Column(Boolean, default=False)
    created_at  = Column(DateTime, default=datetime.utcnow)

    scenario = relationship("Scenario", back_populates="sessions")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id          = Column(String, primary_key=True)
    current_level    = Column(String, default="A1")
    # NULL = never explicitly chosen; the frontend then derives a default
    # from the user's primary explanation language (LocaleSync.tsx)
    ui_language      = Column(String, default=None)
    daily_goal_words = Column(Integer, default=10)
    streak_days      = Column(Integer, default=0)
    last_active      = Column(String, default=_today)
    created_at       = Column(DateTime, default=datetime.utcnow)


class WritingTopic(Base):
    __tablename__ = "writing_topics"

    id              = Column(String, primary_key=True, default=_uuid)
    title           = Column(String, nullable=False)
    description     = Column(Text)
    prompt          = Column(Text, nullable=False)
    level           = Column(String, nullable=False, index=True)   # A1-C2
    writing_type    = Column(String, nullable=False)               # Erörterung, Bericht…
    exam            = Column(String, nullable=True)                # "Goethe B2", "TestDaF", None…
    word_count_min  = Column(Integer, default=80)
    word_count_max  = Column(Integer, default=300)
    time_limit_min  = Column(Integer, nullable=True)

    sessions = relationship("WritingSession", back_populates="topic", cascade="all, delete-orphan")


class Annotation(Base):
    __tablename__ = "annotations"

    id         = Column(String, primary_key=True, default=_uuid)
    user_id    = Column(String, nullable=False, index=True)
    book_id    = Column(String, nullable=False, index=True)
    page_num   = Column(Integer, nullable=False)
    x          = Column(Float, nullable=False)
    y          = Column(Float, nullable=False)
    content    = Column(Text, default="")
    color      = Column(String, default="#EF4444")
    mark_type  = Column(String, default="text")
    font_size  = Column(Integer, default=12)
    ann_width  = Column(Float, nullable=True)
    ann_height = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class WritingSession(Base):
    __tablename__ = "writing_sessions"

    id          = Column(String, primary_key=True, default=_uuid)
    user_id     = Column(String, nullable=False, index=True)
    topic_id    = Column(String, ForeignKey("writing_topics.id", ondelete="SET NULL"), nullable=True)
    user_text   = Column(Text, nullable=False)
    feedback    = Column(JSON, nullable=True)   # full AI response dict
    score       = Column(Float, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

    topic = relationship("WritingTopic", back_populates="sessions")


class PageContext(Base):
    __tablename__ = "page_contexts"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    book_id    = Column(String, nullable=False, index=True)
    page_num   = Column(Integer, nullable=False)
    content    = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("book_id", "page_num", name="uq_page_context"),)
