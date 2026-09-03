from app.domain.hierarchy_engine import HierarchyEngine, LOCATION_TYPE_RANKS

def test_type_hierarchy_validation():
    # Valid hierarchy ranks: Child >= Parent
    assert HierarchyEngine.validate_type_hierarchy(None, "COMPANY") is True
    assert HierarchyEngine.validate_type_hierarchy("COMPANY", "BUSINESS_UNIT") is True
    assert HierarchyEngine.validate_type_hierarchy("BUSINESS_UNIT", "REGION") is True
    assert HierarchyEngine.validate_type_hierarchy("REGION", "BRANCH") is True
    assert HierarchyEngine.validate_type_hierarchy("BRANCH", "WAREHOUSE") is True
    assert HierarchyEngine.validate_type_hierarchy("BRANCH", "POS") is True

    # Invalid: Child rank < Parent rank
    assert HierarchyEngine.validate_type_hierarchy("POS", "COMPANY") is False
    assert HierarchyEngine.validate_type_hierarchy("BRANCH", "REGION") is False

def test_circular_dependency_detection():
    # parent_map: child_id -> parent_id
    parent_map = {
        "A": None,
        "B": "A",
        "C": "B",
        "D": "C",
    }

    # Setting D's parent to None or A is safe
    assert HierarchyEngine.has_circular_dependency(parent_map, "D", None) is False
    assert HierarchyEngine.has_circular_dependency(parent_map, "D", "A") is False

    # Setting self as parent is circular
    assert HierarchyEngine.has_circular_dependency(parent_map, "A", "A") is True

    # Setting A's parent to D would create A -> D -> C -> B -> A (cycle)
    assert HierarchyEngine.has_circular_dependency(parent_map, "A", "D") is True
    assert HierarchyEngine.has_circular_dependency(parent_map, "B", "D") is True

def test_build_tree():
    items = [
        {"id": "c1", "name": "Mega Corp", "parentId": None, "type": "COMPANY"},
        {"id": "r1", "name": "East Region", "parentId": "c1", "type": "REGION"},
        {"id": "b1", "name": "Central Store", "parentId": "r1", "type": "BRANCH"},
        {"id": "p1", "name": "POS 1", "parentId": "b1", "type": "POS"},
        {"id": "p2", "name": "POS 2", "parentId": "b1", "type": "POS"},
    ]

    tree = HierarchyEngine.build_tree(items)
    assert len(tree) == 1
    root = tree[0]
    assert root["id"] == "c1"
    assert len(root["children"]) == 1
    region = root["children"][0]
    assert region["id"] == "r1"
    assert len(region["children"]) == 1
    branch = region["children"][0]
    assert branch["id"] == "b1"
    assert len(branch["children"]) == 2

def test_ancestor_path_breadcrumbs():
    items_map = {
        "c1": {"id": "c1", "name": "HQ", "parentId": None},
        "r1": {"id": "r1", "name": "North", "parentId": "c1"},
        "b1": {"id": "b1", "name": "Downtown", "parentId": "r1"},
        "p1": {"id": "p1", "name": "Register 1", "parentId": "b1"},
    }

    path = HierarchyEngine.get_ancestor_path(items_map, "p1")
    assert len(path) == 4
    assert [n["id"] for n in path] == ["c1", "r1", "b1", "p1"]

def test_descendant_ids():
    children_map = {
        "c1": ["r1", "r2"],
        "r1": ["b1"],
        "r2": ["b2"],
        "b1": ["p1", "w1"],
        "b2": [],
    }

    descendants_c1 = HierarchyEngine.get_descendant_ids(children_map, "c1")
    assert descendants_c1 == {"r1", "r2", "b1", "b2", "p1", "w1"}

    descendants_b1 = HierarchyEngine.get_descendant_ids(children_map, "b1")
    assert descendants_b1 == {"p1", "w1"}
