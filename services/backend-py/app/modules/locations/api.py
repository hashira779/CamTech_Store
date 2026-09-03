from typing import Optional, List, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.dependencies import get_current_user, TenantUser
from app.domain.hierarchy_engine import HierarchyEngine

from .models import Location
from .schemas import (
    LocationDto, LocationTreeNodeDto, CreateLocationInput, UpdateLocationInput,
    PaginatedResponse, PageMeta
)

router = APIRouter(tags=["Locations"])

@router.get("", response_model=PaginatedResponse[LocationDto])
async def list_locations(
    page: int = 1,
    limit: int = 50,
    search: Optional[str] = None,
    type: Optional[str] = None,
    parentId: Optional[str] = None,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Location).where(Location.organization_id == user.organization_id)
    if search:
        stmt = stmt.where(Location.name.ilike(f"%{search}%") | Location.code.ilike(f"%{search}%"))
    if type:
        stmt = stmt.where(Location.type == type.upper())
    if parentId is not None:
        if parentId == "" or parentId.lower() == "null":
            stmt = stmt.where(Location.parent_id.is_(None))
        else:
            stmt = stmt.where(Location.parent_id == parentId)

    result = await db.execute(stmt)
    all_locations = result.scalars().all()

    all_tenant_res = await db.execute(select(Location).where(Location.organization_id == user.organization_id))
    tenant_locs = {l.id: l for l in all_tenant_res.scalars().all()}

    children_counts: Dict[str, int] = {}
    for l in tenant_locs.values():
        if l.parent_id:
            children_counts[l.parent_id] = children_counts.get(l.parent_id, 0) + 1

    total = len(all_locations)
    offset = (page - 1) * limit
    paged = all_locations[offset:offset + limit]

    items = []
    for loc in paged:
        parent_summary = None
        if loc.parent_id and loc.parent_id in tenant_locs:
            p_obj = tenant_locs[loc.parent_id]
            parent_summary = {
                "id": p_obj.id,
                "name": p_obj.name,
                "type": p_obj.type
            }

        items.append(LocationDto(
            id=loc.id,
            organizationId=loc.organization_id,
            parentId=loc.parent_id,
            type=loc.type,
            name=loc.name,
            code=loc.code,
            isActive=True,
            createdAt=loc.created_at.isoformat() if loc.created_at else None,
            updatedAt=loc.updated_at.isoformat() if loc.updated_at else None,
            parent=parent_summary,
            childrenCount=children_counts.get(loc.id, 0)
        ))

    total_pages = max(1, (total + limit - 1) // limit)
    return PaginatedResponse(
        items=items,
        meta=PageMeta(page=page, limit=limit, total=total, totalPages=total_pages),
        total=total
    )

@router.get("/tree", response_model=List[LocationTreeNodeDto])
async def get_locations_tree(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Location).where(Location.organization_id == user.organization_id)
    )
    locations = result.scalars().all()

    dict_items = [
        {
            "id": loc.id,
            "organizationId": loc.organization_id,
            "parentId": loc.parent_id,
            "type": loc.type,
            "name": loc.name,
            "code": loc.code,
            "createdAt": loc.created_at.isoformat() if loc.created_at else None,
        }
        for loc in locations
    ]

    tree = HierarchyEngine.build_tree(
        dict_items,
        id_key="id",
        parent_key="parentId",
        children_key="children",
        sort_by="name"
    )
    return tree

@router.get("/{location_id}/breadcrumbs")
async def get_location_breadcrumbs(
    location_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Location).where(Location.organization_id == user.organization_id)
    )
    locations = result.scalars().all()
    items_map = {
        loc.id: {
            "id": loc.id,
            "name": loc.name,
            "code": loc.code,
            "type": loc.type,
            "parentId": loc.parent_id
        }
        for loc in locations
    }

    if location_id not in items_map:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    path = HierarchyEngine.get_ancestor_path(items_map, location_id, parent_key="parentId")
    return {"locationId": location_id, "breadcrumbs": path}

@router.get("/{location_id}/descendants")
async def get_location_descendants(
    location_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Location).where(Location.organization_id == user.organization_id)
    )
    locations = result.scalars().all()

    children_map: Dict[str, List[str]] = {}
    for loc in locations:
        if loc.parent_id:
            children_map.setdefault(loc.parent_id, []).append(loc.id)

    descendants = HierarchyEngine.get_descendant_ids(children_map, location_id)
    return {"locationId": location_id, "descendantIds": list(descendants), "count": len(descendants)}

@router.post("", response_model=LocationDto)
async def create_location(
    loc_in: CreateLocationInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    parent_loc = None
    if loc_in.parentId:
        p_res = await db.execute(
            select(Location).where(
                Location.id == loc_in.parentId,
                Location.organization_id == user.organization_id
            )
        )
        parent_loc = p_res.scalar_one_or_none()
        if not parent_loc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Parent location not found: {loc_in.parentId}"
            )

        if not HierarchyEngine.validate_type_hierarchy(parent_loc.type, loc_in.type):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid hierarchy: A '{loc_in.type}' cannot be nested directly under a '{parent_loc.type}'"
            )

    if loc_in.code:
        code_check = await db.execute(
            select(Location).where(
                Location.organization_id == user.organization_id,
                Location.code == loc_in.code
            )
        )
        if code_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Location with code '{loc_in.code}' already exists"
            )

    loc = Location(
        organization_id=user.organization_id,
        name=loc_in.name,
        code=loc_in.code,
        type=loc_in.type.upper(),
        parent_id=loc_in.parentId
    )
    db.add(loc)
    await db.commit()
    await db.refresh(loc)

    parent_summary = None
    if parent_loc:
        parent_summary = {"id": parent_loc.id, "name": parent_loc.name, "type": parent_loc.type}

    return LocationDto(
        id=loc.id,
        organizationId=loc.organization_id,
        parentId=loc.parent_id,
        type=loc.type,
        name=loc.name,
        code=loc.code,
        isActive=True,
        createdAt=loc.created_at.isoformat() if loc.created_at else None,
        updatedAt=loc.updated_at.isoformat() if loc.updated_at else None,
        parent=parent_summary,
        childrenCount=0
    )

@router.patch("/{location_id}", response_model=LocationDto)
@router.put("/{location_id}", response_model=LocationDto)
async def update_location(
    location_id: str,
    loc_in: UpdateLocationInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Location).where(
            Location.id == location_id,
            Location.organization_id == user.organization_id
        )
    )
    loc = result.scalar_one_or_none()
    if not loc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    if loc_in.parentId is not None and loc_in.parentId != loc.parent_id:
        all_res = await db.execute(
            select(Location).where(Location.organization_id == user.organization_id)
        )
        all_locs = all_res.scalars().all()
        parent_map = {l.id: l.parent_id for l in all_locs}

        if HierarchyEngine.has_circular_dependency(parent_map, location_id, loc_in.parentId):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Circular hierarchy dependency detected: A location cannot be set as a child of itself or its descendants"
            )

        if loc_in.parentId:
            parent_node = next((l for l in all_locs if l.id == loc_in.parentId), None)
            target_type = loc_in.type or loc.type
            if parent_node and not HierarchyEngine.validate_type_hierarchy(parent_node.type, target_type):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid hierarchy: '{target_type}' cannot be nested under '{parent_node.type}'"
                )

        loc.parent_id = loc_in.parentId

    if loc_in.name is not None:
        loc.name = loc_in.name
    if loc_in.code is not None:
        loc.code = loc_in.code
    if loc_in.type is not None:
        loc.type = loc_in.type.upper()

    await db.commit()
    await db.refresh(loc)

    parent_summary = None
    if loc.parent_id:
        p_res = await db.execute(select(Location).where(Location.id == loc.parent_id))
        p_obj = p_res.scalar_one_or_none()
        if p_obj:
            parent_summary = {"id": p_obj.id, "name": p_obj.name, "type": p_obj.type}

    child_cnt_res = await db.execute(
        select(Location).where(
            Location.parent_id == loc.id,
            Location.organization_id == user.organization_id
        )
    )
    children_count = len(child_cnt_res.scalars().all())

    return LocationDto(
        id=loc.id,
        organizationId=loc.organization_id,
        parentId=loc.parent_id,
        type=loc.type,
        name=loc.name,
        code=loc.code,
        isActive=True,
        createdAt=loc.created_at.isoformat() if loc.created_at else None,
        updatedAt=loc.updated_at.isoformat() if loc.updated_at else None,
        parent=parent_summary,
        childrenCount=children_count
    )

@router.delete("/{location_id}")
async def delete_location(
    location_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Location).where(
            Location.id == location_id,
            Location.organization_id == user.organization_id
        )
    )
    loc = result.scalar_one_or_none()
    if not loc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    child_check = await db.execute(
        select(Location).where(
            Location.parent_id == location_id,
            Location.organization_id == user.organization_id
        )
    )
    if child_check.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete location with child sub-locations"
        )

    await db.delete(loc)
    await db.commit()
    return {"deleted": True, "id": location_id}
