from typing import List, Dict, Any, Optional, Set

LOCATION_TYPE_RANKS: Dict[str, int] = {
    "COMPANY": 1,
    "BUSINESS_UNIT": 2,
    "REGION": 3,
    "BRANCH": 4,
    "DEPARTMENT": 5,
    "WAREHOUSE": 6,
    "POS": 6,
}

class HierarchyEngine:
    """
    Universal Enterprise Hierarchy Engine (Spec §11, §12).
    Manages recursive organizational and catalog trees with:
    - Circular dependency prevention (cycle detection)
    - Hierarchical type ordering and validation
    - Multi-tier recursive tree construction
    - Breadcrumbs / ancestry path calculation
    - Subtree descendant resolution (for roll-up aggregation)
    """

    @staticmethod
    def validate_type_hierarchy(parent_type: Optional[str], child_type: str) -> bool:
        """
        Validates that child type is logically valid under parent type.
        Rule: child rank must be >= parent rank.
        """
        if not parent_type:
            return True
        parent_rank = LOCATION_TYPE_RANKS.get(parent_type.upper(), 99)
        child_rank = LOCATION_TYPE_RANKS.get(child_type.upper(), 99)
        return child_rank >= parent_rank

    @staticmethod
    def has_circular_dependency(
        parent_map: Dict[str, Optional[str]],
        target_id: str,
        new_parent_id: Optional[str]
    ) -> bool:
        """
        Detects if assigning new_parent_id to target_id would introduce a cycle.
        Returns True if a cycle is detected, False otherwise.
        """
        if not new_parent_id:
            return False
        if target_id == new_parent_id:
            return True

        curr: Optional[str] = new_parent_id
        visited: Set[str] = set()

        while curr is not None:
            if curr == target_id:
                return True
            if curr in visited:
                return True
            visited.add(curr)
            curr = parent_map.get(curr)

        return False

    @staticmethod
    def build_tree(
        items: List[Dict[str, Any]],
        id_key: str = "id",
        parent_key: str = "parentId",
        children_key: str = "children",
        sort_by: str = "name"
    ) -> List[Dict[str, Any]]:
        """
        Assembles a flat list of node dicts into a properly nested recursive tree.
        Preserves all node attributes and initializes empty children lists.
        """
        node_map: Dict[str, Dict[str, Any]] = {}
        for item in items:
            node_id = item[id_key]
            node = dict(item)
            node[children_key] = []
            node_map[node_id] = node

        roots: List[Dict[str, Any]] = []
        for item in items:
            node_id = item[id_key]
            parent_id = item.get(parent_key)
            node = node_map[node_id]

            if parent_id and parent_id in node_map:
                node_map[parent_id][children_key].append(node)
            else:
                roots.append(node)

        def sort_children(n_list: List[Dict[str, Any]]):
            n_list.sort(key=lambda x: (x.get("type", ""), x.get(sort_by, "")))
            for n in n_list:
                sort_children(n[children_key])

        sort_children(roots)
        return roots

    @staticmethod
    def get_ancestor_path(
        items_map: Dict[str, Dict[str, Any]],
        node_id: str,
        parent_key: str = "parentId"
    ) -> List[Dict[str, Any]]:
        """
        Calculates the breadcrumb path from the root down to the given node.
        Example: [Company, Region, Branch, POS]
        """
        path: List[Dict[str, Any]] = []
        curr_id: Optional[str] = node_id
        visited: Set[str] = set()

        while curr_id and curr_id in items_map:
            if curr_id in visited:
                break
            visited.add(curr_id)
            node = items_map[curr_id]
            path.append(node)
            curr_id = node.get(parent_key)

        path.reverse()
        return path

    @staticmethod
    def get_descendant_ids(
        children_map: Dict[str, List[str]],
        root_id: str
    ) -> Set[str]:
        """
        Returns all descendant IDs under root_id (excluding root_id itself).
        Useful for aggregating inventory, sales, or workforce across branches.
        """
        descendants: Set[str] = set()
        queue: List[str] = list(children_map.get(root_id, []))

        while queue:
            curr = queue.pop(0)
            if curr not in descendants:
                descendants.add(curr)
                queue.extend(children_map.get(curr, []))

        return descendants
