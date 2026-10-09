"""Add default location to customers

Revision ID: c04ccfb4a570
Revises: 4bb1163328b1
Create Date: 2026-10-10 00:16:26.924650

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c04ccfb4a570'
down_revision: Union[str, Sequence[str], None] = '4bb1163328b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('customers', sa.Column('defaultAddress', sa.String(), nullable=True))
    op.add_column('customers', sa.Column('defaultLat', sa.Float(), nullable=True))
    op.add_column('customers', sa.Column('defaultLng', sa.Float(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('customers', 'defaultLng')
    op.drop_column('customers', 'defaultLat')
    op.drop_column('customers', 'defaultAddress')
