import json
import datetime
import secrets
from decimal import Decimal
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import (
    verify_password, create_access_token, create_refresh_token,
    decode_refresh_token, generate_totp_secret, verify_totp_code,
    get_totp_uri
)
from app.core.dependencies import get_current_user, TenantUser
from app.models.entities import (
    User, Organization, Product, ProductVariant, InventoryItem, Location,
    Category, Sale, SaleLineItem, SalePayment, Customer, Account, JournalEntry,
    JournalLine, FixedAsset, ServiceTicket, DeveloperApp, ApiKey,
    TelegramChatBinding, AutomationFlow, FlowExecution
)
from app.schemas.dto import (
    LoginRequest, LoginResponse, RefreshTokenRequest, TokenResponse,
    OrganizationDto, UpdateOrganizationInput,
    UserDto, ProductDto, CreateProductInput,
    InventoryItemDto, LocationDto, CreateLocationInput, UpdateLocationInput, LocationTreeNodeDto,
    CategoryDto, CreateCategoryInput, UpdateCategoryInput, CategoryTreeNodeDto,
    SaleDto, CreateSaleInput, CustomerDto,
    CreateCustomerInput, PaginatedResponse, VariantDto, PageMeta
)
from app.domain.hierarchy_engine import HierarchyEngine
from app.domain.enterprise_engines import FlowExecutionEngine, ApiKeyGenerator, TelegramCommandRouter
from app.domain.commerce_engines import KhqrGenerator


router = APIRouter()

# (Auth routes have been extracted to app.modules.identity)
# (Catalog routes have been extracted to app.modules.catalog)

# (Locations and Organizations routes have been extracted to app.modules)

# (Category routes have been extracted to app.modules.catalog)



# (Inventory routes have been extracted to app.modules.inventory)

# ==============================================================================
# 4. SALES & POS CHECKOUT
# ==============================================================================

# (Sales routes have been extracted to app.modules.sales)
# 5. CUSTOMERS & CRM
# ==============================================================================

# (Customer routes have been extracted to app.modules.customers)
