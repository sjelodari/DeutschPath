import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "deutschpath.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from models import Base
    Base.metadata.create_all(bind=engine)
    _migrate_sqlite()
    _seed_if_empty()


def _migrate_sqlite():
    """Add new columns to existing SQLite tables if they're missing."""
    with engine.connect() as conn:
        from sqlalchemy import text

        existing_sc = {row[1] for row in conn.execute(text("PRAGMA table_info(scenarios)")).fetchall()}
        for col, typedef in [("subject", "TEXT"), ("scenario_type", "TEXT"), ("opening_message", "TEXT")]:
            if col not in existing_sc:
                conn.execute(text(f"ALTER TABLE scenarios ADD COLUMN {col} {typedef}"))

        existing_bk = {row[1] for row in conn.execute(text("PRAGMA table_info(books)")).fetchall()}
        if "file_type" not in existing_bk:
            conn.execute(text("ALTER TABLE books ADD COLUMN file_type TEXT DEFAULT 'pdf'"))

        existing_gr = {row[1] for row in conn.execute(text("PRAGMA table_info(grammar_rules)")).fetchall()}
        if "translations" not in existing_gr:
            conn.execute(text("ALTER TABLE grammar_rules ADD COLUMN translations TEXT DEFAULT '{}'"))

        # One-time data fixes, keyed in schema_meta so they never re-run.
        conn.execute(text("CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT)"))
        done = {row[0] for row in conn.execute(text("SELECT key FROM schema_meta")).fetchall()}
        if "ui_language_reset_v1" not in done:
            # ui_language rows written before the UI-language feature existed hold
            # a dead Python-side default ('fa') the user never chose. NULL means
            # "never chosen" so the frontend can derive a sensible default.
            conn.execute(text("UPDATE user_profiles SET ui_language = NULL"))
            conn.execute(text("INSERT INTO schema_meta (key, value) VALUES ('ui_language_reset_v1', '1')"))

        existing_ann = {row[1] for row in conn.execute(text("PRAGMA table_info(annotations)")).fetchall()}
        if "mark_type" not in existing_ann:
            conn.execute(text("ALTER TABLE annotations ADD COLUMN mark_type TEXT DEFAULT 'text'"))
        if "font_size" not in existing_ann:
            conn.execute(text("ALTER TABLE annotations ADD COLUMN font_size INTEGER DEFAULT 12"))
        if "ann_width" not in existing_ann:
            conn.execute(text("ALTER TABLE annotations ADD COLUMN ann_width REAL"))
        if "ann_height" not in existing_ann:
            conn.execute(text("ALTER TABLE annotations ADD COLUMN ann_height REAL"))

        conn.commit()


def _seed_if_empty():
    """Insert missing seed records and update existing ones with new fields."""
    from models import GrammarRule, Scenario, WritingTopic
    from seed_data import GRAMMAR_RULES, SCENARIOS, WRITING_TOPICS

    db = SessionLocal()
    try:
        existing_rules = {r.name for r in db.query(GrammarRule.name).all()}
        for r in GRAMMAR_RULES:
            if r["name"] not in existing_rules:
                db.add(GrammarRule(**r))
        db.commit()

        existing_map = {s.name: s for s in db.query(Scenario).all()}
        for s in SCENARIOS:
            if s["name"] not in existing_map:
                db.add(Scenario(**s))
            else:
                # Update new fields on existing rows
                row = existing_map[s["name"]]
                for field in ("subject", "scenario_type", "opening_message"):
                    if field in s and getattr(row, field, None) is None:
                        setattr(row, field, s[field])
        db.commit()

        existing_topics = {t.id for t in db.query(WritingTopic.id).all()}
        for t in WRITING_TOPICS:
            if t["id"] not in existing_topics:
                db.add(WritingTopic(**t))
        db.commit()
    finally:
        db.close()
