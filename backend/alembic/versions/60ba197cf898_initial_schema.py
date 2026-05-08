"""initial schema

Revision ID: 60ba197cf898
Revises:
Create Date: 2026-05-08 09:22:13.067393

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '60ba197cf898'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'processes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('code', sa.String(length=50), nullable=False, unique=True),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('objective', sa.Text(), nullable=True),
        sa.Column('owner', sa.String(length=255), nullable=True),
        sa.Column('department', sa.String(length=255), nullable=True),
        sa.Column('is_critical', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('critical_reason', sa.Text(), nullable=True),
        sa.Column('last_assessment_date', sa.Date(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'applications',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('code', sa.String(length=50), nullable=False, unique=True),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('business_owner', sa.String(length=255), nullable=True),
        sa.Column('technical_owner', sa.String(length=255), nullable=True),
        sa.Column('review_date', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'process_applications',
        sa.Column('process_id', sa.Integer(), sa.ForeignKey('processes.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('application_id', sa.Integer(), sa.ForeignKey('applications.id', ondelete='CASCADE'), primary_key=True),
    )

    op.create_table(
        'bia_assessments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('process_id', sa.Integer(), sa.ForeignKey('processes.id', ondelete='CASCADE'), unique=True, nullable=False),
        sa.Column('availability_score', sa.SmallInteger(), nullable=True),
        sa.Column('integrity_score', sa.SmallInteger(), nullable=True),
        sa.Column('confidentiality_score', sa.SmallInteger(), nullable=True),
        # Beschikbaarheid B1–B8
        sa.Column('b1_score', sa.SmallInteger(), nullable=True),
        sa.Column('b1_arg', sa.Text(), nullable=True),
        sa.Column('b2_score', sa.SmallInteger(), nullable=True),
        sa.Column('b2_arg', sa.Text(), nullable=True),
        sa.Column('b3_score', sa.SmallInteger(), nullable=True),
        sa.Column('b3_arg', sa.Text(), nullable=True),
        sa.Column('b4_score', sa.SmallInteger(), nullable=True),
        sa.Column('b4_arg', sa.Text(), nullable=True),
        sa.Column('b5_score', sa.SmallInteger(), nullable=True),
        sa.Column('b5_arg', sa.Text(), nullable=True),
        sa.Column('b6_score', sa.SmallInteger(), nullable=True),
        sa.Column('b6_arg', sa.Text(), nullable=True),
        sa.Column('b7_score', sa.SmallInteger(), nullable=True),
        sa.Column('b7_arg', sa.Text(), nullable=True),
        sa.Column('b8_score', sa.SmallInteger(), nullable=True),
        sa.Column('b8_arg', sa.Text(), nullable=True),
        # Integriteit I1–I7
        sa.Column('i1_score', sa.SmallInteger(), nullable=True),
        sa.Column('i1_arg', sa.Text(), nullable=True),
        sa.Column('i2_score', sa.SmallInteger(), nullable=True),
        sa.Column('i2_arg', sa.Text(), nullable=True),
        sa.Column('i3_score', sa.SmallInteger(), nullable=True),
        sa.Column('i3_arg', sa.Text(), nullable=True),
        sa.Column('i4_score', sa.SmallInteger(), nullable=True),
        sa.Column('i4_arg', sa.Text(), nullable=True),
        sa.Column('i5_score', sa.SmallInteger(), nullable=True),
        sa.Column('i5_arg', sa.Text(), nullable=True),
        sa.Column('i6_score', sa.SmallInteger(), nullable=True),
        sa.Column('i6_arg', sa.Text(), nullable=True),
        sa.Column('i7_score', sa.SmallInteger(), nullable=True),
        sa.Column('i7_arg', sa.Text(), nullable=True),
        # Vertrouwelijkheid V1–V7
        sa.Column('v1_score', sa.SmallInteger(), nullable=True),
        sa.Column('v1_arg', sa.Text(), nullable=True),
        sa.Column('v2_score', sa.SmallInteger(), nullable=True),
        sa.Column('v2_arg', sa.Text(), nullable=True),
        sa.Column('v3_score', sa.SmallInteger(), nullable=True),
        sa.Column('v3_arg', sa.Text(), nullable=True),
        sa.Column('v4_score', sa.SmallInteger(), nullable=True),
        sa.Column('v4_arg', sa.Text(), nullable=True),
        sa.Column('v5_score', sa.SmallInteger(), nullable=True),
        sa.Column('v5_arg', sa.Text(), nullable=True),
        sa.Column('v6_score', sa.SmallInteger(), nullable=True),
        sa.Column('v6_arg', sa.Text(), nullable=True),
        sa.Column('v7_score', sa.SmallInteger(), nullable=True),
        sa.Column('v7_arg', sa.Text(), nullable=True),
        # Algemeen
        sa.Column('interviewer_name', sa.String(length=255), nullable=True),
        sa.Column('interview_date', sa.Date(), nullable=True),
        sa.Column('general_description', sa.Text(), nullable=True),
        sa.Column('chain_dependencies', sa.Text(), nullable=True),
        sa.Column('owner_deviation_motivation', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'rto_rpo',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('process_id', sa.Integer(), sa.ForeignKey('processes.id', ondelete='CASCADE'), unique=True, nullable=False),
        sa.Column('rto_value', sa.Float(), nullable=True),
        sa.Column('rto_unit', sa.String(length=50), nullable=True),
        sa.Column('rpo_value', sa.Float(), nullable=True),
        sa.Column('rpo_unit', sa.String(length=50), nullable=True),
        sa.Column('explanation', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'business_contexts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('process_id', sa.Integer(), sa.ForeignKey('processes.id', ondelete='CASCADE'), unique=True, nullable=False),
        sa.Column('key_partners', sa.Text(), nullable=True),
        sa.Column('key_activities', sa.Text(), nullable=True),
        sa.Column('key_resources', sa.Text(), nullable=True),
        sa.Column('value_proposition', sa.Text(), nullable=True),
        sa.Column('customer_relationships', sa.Text(), nullable=True),
        sa.Column('channels', sa.Text(), nullable=True),
        sa.Column('customer_segments', sa.Text(), nullable=True),
        sa.Column('cost_structure', sa.Text(), nullable=True),
        sa.Column('revenue_streams', sa.Text(), nullable=True),
        sa.Column('legal_basis', sa.Text(), nullable=True),
        sa.Column('stakeholders', sa.Text(), nullable=True),
        sa.Column('chain_position', sa.Text(), nullable=True),
        sa.Column('key_aspects', sa.Text(), nullable=True),
        sa.Column('personal_data', sa.Boolean(), nullable=True),
        sa.Column('special_personal_data', sa.Boolean(), nullable=True),
        sa.Column('continuity_requirements', sa.Text(), nullable=True),
        sa.Column('review_date', sa.Date(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('business_contexts')
    op.drop_table('rto_rpo')
    op.drop_table('bia_assessments')
    op.drop_table('process_applications')
    op.drop_table('applications')
    op.drop_table('processes')
