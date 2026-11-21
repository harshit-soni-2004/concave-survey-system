"""initial schema

Revision ID: 0001_initial
Revises: 
Create Date: 2026-11-21 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. admin_users
    op.create_table(
        'admin_users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('role', sa.String(length=16), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email', name='uq_admin_users_email')
    )
    op.create_index('ix_admin_users_id', 'admin_users', ['id'])
    op.create_index('ix_admin_users_email', 'admin_users', ['email'])

    # 2. surveys
    op.create_table(
        'surveys',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('slug', sa.String(length=64), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=16), nullable=False, server_default='DRAFT'),
        sa.Column('closed_reason', sa.String(length=16), nullable=True),
        sa.Column('target', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('active_version_id', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('deadline_at', sa.DateTime(), nullable=True),
        sa.Column('closed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['admin_users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug', name='uq_surveys_slug')
    )
    op.create_index('ix_surveys_id', 'surveys', ['id'])
    op.create_index('ix_surveys_slug', 'surveys', ['slug'])
    op.create_index('idx_surveys_status_deadline', 'surveys', ['status', 'deadline_at'])

    # 3. survey_versions
    op.create_table(
        'survey_versions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('survey_id', sa.Integer(), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('questionnaire_data', sa.JSON(), nullable=False),
        sa.Column('raw_content', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=16), nullable=False, server_default='DRAFT'),
        sa.Column('uploaded_by', sa.Integer(), nullable=True),
        sa.Column('approved_by', sa.Integer(), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['survey_id'], ['surveys.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by'], ['admin_users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['approved_by'], ['admin_users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('survey_id', 'version_number', name='uq_survey_version')
    )
    op.create_index('ix_survey_versions_id', 'survey_versions', ['id'])

    # add FK for surveys.active_version_id to survey_versions.id
    op.create_foreign_key(
        'fk_surveys_active_version',
        'surveys',
        'survey_versions',
        ['active_version_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # 4. quotas
    op.create_table(
        'quotas',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('survey_id', sa.Integer(), nullable=False),
        sa.Column('question_id', sa.String(length=64), nullable=False),
        sa.Column('value', sa.String(length=255), nullable=False),
        sa.Column('target', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['survey_id'], ['surveys.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('survey_id', 'question_id', 'value', name='uq_survey_question_value')
    )
    op.create_index('ix_quotas_id', 'quotas', ['id'])

    # 5. respondents
    op.create_table(
        'respondents',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('survey_id', sa.Integer(), nullable=False),
        sa.Column('survey_version_id', sa.Integer(), nullable=True),
        sa.Column('token', sa.String(length=64), nullable=False),
        sa.Column('status', sa.String(length=16), nullable=False, server_default='NOT_STARTED'),
        sa.Column('is_test', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('is_silent_termination', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('termination_reason', sa.Text(), nullable=True),
        sa.Column('current_question_id', sa.String(length=64), nullable=True),
        sa.Column('path', sa.JSON(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['survey_id'], ['surveys.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['survey_version_id'], ['survey_versions.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token', name='uq_respondents_token')
    )
    op.create_index('ix_respondents_token', 'respondents', ['token'])
    op.create_index('idx_respondents_survey_status_test', 'respondents', ['survey_id', 'status', 'is_test'])

    # 6. respondent_terminations
    op.create_table(
        'respondent_terminations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('respondent_id', sa.String(length=36), nullable=False),
        sa.Column('question_id', sa.String(length=64), nullable=False),
        sa.Column('reason', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['respondent_id'], ['respondents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_respondent_terminations_id', 'respondent_terminations', ['id'])
    op.create_index('idx_terminations_reason', 'respondent_terminations', ['reason'])
    op.create_index('idx_terminations_question', 'respondent_terminations', ['question_id'])

    # 7. answers
    op.create_table(
        'answers',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('respondent_id', sa.String(length=36), nullable=False),
        sa.Column('question_id', sa.String(length=64), nullable=False),
        sa.Column('answer_value', sa.JSON(), nullable=False),
        sa.Column('other_text', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['respondent_id'], ['respondents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('respondent_id', 'question_id', name='uq_respondent_question')
    )
    op.create_index('ix_answers_id', 'answers', ['id'])
    op.create_index('idx_answers_question', 'answers', ['question_id'])

    # 8. answer_options
    op.create_table(
        'answer_options',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('answer_id', sa.Integer(), nullable=False),
        sa.Column('question_id', sa.String(length=64), nullable=False),
        sa.Column('option_value', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['answer_id'], ['answers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_answer_options_id', 'answer_options', ['id'])
    op.create_index('idx_answer_options_lookup', 'answer_options', ['question_id', 'option_value'])

def downgrade() -> None:
    op.drop_table('answer_options')
    op.drop_table('answers')
    op.drop_table('respondent_terminations')
    op.drop_table('respondents')
    op.drop_table('quotas')
    op.drop_constraint('fk_surveys_active_version', 'surveys', type_='foreignkey')
    op.drop_table('survey_versions')
    op.drop_table('surveys')
    op.drop_table('admin_users')
