import pytest
from app.domain.delivery_engine import DeliveryEngine

def test_haversine_distance():
    # Distance between Phnom Penh Central Post Office (11.5721, 104.9282) and Aeon Mall 1 (11.5478, 104.9336)
    # Approx 2.7 - 2.8 km
    dist = DeliveryEngine.calculate_distance_km(11.5721, 104.9282, 11.5478, 104.9336)
    assert 2.5 <= dist <= 3.0

def test_eta_calculation():
    # 6 km by motorcycle
    eta_moto = DeliveryEngine.calculate_eta_minutes(6.0, "MOTORCYCLE")
    assert 10 <= eta_moto <= 25

    # 6 km by truck (slower)
    eta_truck = DeliveryEngine.calculate_eta_minutes(6.0, "TRUCK")
    assert eta_truck >= eta_moto

def test_status_transitions():
    assert DeliveryEngine.validate_status_transition("PENDING", "DISPATCHED") is True
    assert DeliveryEngine.validate_status_transition("DISPATCHED", "IN_TRANSIT") is True
    assert DeliveryEngine.validate_status_transition("IN_TRANSIT", "DELIVERED") is True

    # Invalid: PENDING cannot jump straight to DELIVERED without dispatch
    assert DeliveryEngine.validate_status_transition("PENDING", "DELIVERED") is False
    # Delivered cannot transition to anything
    assert DeliveryEngine.validate_status_transition("DELIVERED", "IN_TRANSIT") is False

def test_position_interpolation():
    lat, lng = DeliveryEngine.interpolate_position(10.0, 100.0, 12.0, 104.0, 0.5)
    assert lat == 11.0
    assert lng == 102.0

def test_bearing_calculation():
    # Moving due North
    north_bearing = DeliveryEngine.calculate_bearing(10.0, 100.0, 11.0, 100.0)
    assert 359.0 <= north_bearing <= 360.0 or 0.0 <= north_bearing <= 1.0

    # Moving due East
    east_bearing = DeliveryEngine.calculate_bearing(10.0, 100.0, 10.0, 101.0)
    assert 89.0 <= east_bearing <= 91.0

def test_tracking_number_format():
    trk = DeliveryEngine.generate_tracking_number(42)
    assert trk.startswith("TRK-")
    assert "000042" in trk
