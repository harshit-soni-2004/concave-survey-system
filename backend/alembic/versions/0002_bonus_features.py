"""bonus features

Revision ID: 0002_bonus_features
Revises: 0001_initial
Create Date: 2026-11-22 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '0002_bonus_features'
down_revision = '0001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add meta column to respondents
    op.add_column(
        'respondents',
        sa.Column('meta', sa.JSON(), nullable=False, server_default=sa.text("('{}')"))
    )

    # Add question_id_2 and value_2 to quotas for nested quotas
    op.add_column(
        'quotas',
        sa.Column('question_id_2', sa.String(length=64), nullable=True)
    )
    op.add_column(
        'quotas',
        sa.Column('value_2', sa.String(length=255), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('quotas', 'value_2')
    op.drop_column('quotas', 'question_id_2')
    op.drop_column('respondents', 'meta')
