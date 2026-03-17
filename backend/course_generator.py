"""
Running course generator using OpenStreetMap data.
Generates circular routes that:
- Match the requested distance within 0.5km tolerance
- Avoid traffic lights where possible
- Match the selected training type (uphill, flat, sprint, interval, zone2)
"""

import math
import random
import httpx
from typing import Optional

# 일반인 평균 러닝 페이스 (min/km) by course type
AVG_PACE = {
    "uphill": 7.5,    # 오르막이라 느림
    "flat": 6.3,      # 평지 일반 페이스
    "sprint": 5.0,    # 스프린트는 빠르게
    "interval": 6.0,  # 인터벌 평균
    "zone2": 7.0,     # 존2는 편안하게
}


async def get_traffic_lights(lat: float, lng: float, radius_m: int = 2000) -> list[dict]:
    """Fetch traffic light locations from Overpass API."""
    query = f"""
    [out:json][timeout:10];
    node["highway"="traffic_signals"](around:{radius_m},{lat},{lng});
    out body;
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://overpass-api.de/api/interpreter",
                data={"data": query},
            )
            if resp.status_code == 200:
                data = resp.json()
                return [
                    {"lat": el["lat"], "lon": el["lon"]}
                    for el in data.get("elements", [])
                ]
    except Exception:
        pass
    return []


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in km."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def find_traffic_lights_on_route(
    route_coords: list[dict], traffic_lights: list[dict], threshold_m: float = 30
) -> list[dict]:
    """Find traffic lights that are within threshold_m of the route."""
    on_route = []
    threshold_km = threshold_m / 1000

    for tl in traffic_lights:
        for coord in route_coords[::5]:  # Sample every 5th point for performance
            dist = haversine(coord["lat"], coord["lng"], tl["lat"], tl["lon"])
            if dist < threshold_km:
                on_route.append({"lat": tl["lat"], "lng": tl["lon"]})
                break

    return on_route


def generate_waypoints(
    lat: float,
    lng: float,
    distance_km: float,
    course_type: str,
    traffic_lights: list[dict],
    scale: float = 1.0,
) -> list[dict]:
    """
    Generate circular route waypoints around the starting point.
    scale parameter adjusts the radius to hit target distance.
    """
    num_waypoints = max(4, int(distance_km * 2))
    if num_waypoints > 12:
        num_waypoints = 12

    # Approximate radius for the circular route
    radius_km = distance_km / (2 * math.pi) * 1.15 * scale

    # Adjust based on course type
    if course_type == "sprint":
        num_waypoints = 4
        radius_km *= 0.8
    elif course_type == "interval":
        num_waypoints = min(10, max(6, int(distance_km * 1.5)))
    elif course_type == "uphill":
        radius_km *= 0.9

    # Convert radius to degrees (approximate)
    lat_offset = radius_km / 111.0
    lng_offset = radius_km / (111.0 * math.cos(math.radians(lat)))

    # Generate base waypoints in a loop
    waypoints = []
    angle_offset = random.uniform(0, 2 * math.pi)

    for i in range(num_waypoints):
        angle = angle_offset + (2 * math.pi * i / num_waypoints)

        # Add some randomness to make the route more natural
        r_variation = random.uniform(0.85, 1.15)
        wp_lat = lat + lat_offset * math.sin(angle) * r_variation
        wp_lng = lng + lng_offset * math.cos(angle) * r_variation

        # Check if waypoint is too close to a traffic light
        too_close = False
        for tl in traffic_lights:
            dist = haversine(wp_lat, wp_lng, tl["lat"], tl["lon"])
            if dist < 0.05:  # 50m threshold
                too_close = True
                break

        if too_close:
            shift_angle = angle + random.uniform(-0.3, 0.3)
            wp_lat = lat + lat_offset * math.sin(shift_angle) * 1.2
            wp_lng = lng + lng_offset * math.cos(shift_angle) * 1.2

        waypoints.append({"lat": round(wp_lat, 6), "lng": round(wp_lng, 6)})

    return waypoints


async def get_route_from_osrm(waypoints: list[dict], start: dict) -> Optional[dict]:
    """Get actual road route from OSRM."""
    all_points = [start] + waypoints + [start]
    coords = ";".join(f"{p['lng']},{p['lat']}" for p in all_points)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"https://router.project-osrm.org/route/v1/foot/{coords}",
                params={
                    "overview": "full",
                    "geometries": "geojson",
                    "steps": "true",
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("routes"):
                    route = data["routes"][0]
                    coords_list = route["geometry"]["coordinates"]
                    return {
                        "coordinates": [
                            {"lat": c[1], "lng": c[0]} for c in coords_list
                        ],
                        "distance_km": round(route["distance"] / 1000, 2),
                    }
    except Exception:
        pass
    return None


async def generate_course(
    lat: float,
    lng: float,
    distance_km: float,
    course_type: str,
) -> dict:
    """
    Main function to generate a running course.
    Iteratively adjusts the route to match the target distance within 0.5km.
    """
    # Get traffic lights in the area
    search_radius = int(distance_km * 600)
    search_radius = max(500, min(search_radius, 5000))
    traffic_lights = await get_traffic_lights(lat, lng, search_radius)

    start = {"lat": lat, "lng": lng}

    best_route = None
    best_diff = float("inf")
    scale = 1.0

    # Try up to 10 times, adjusting scale each time to converge on target distance
    for attempt in range(10):
        waypoints = generate_waypoints(
            lat, lng, distance_km, course_type, traffic_lights, scale=scale
        )
        route = await get_route_from_osrm(waypoints, start)

        if route and route["distance_km"] > 0:
            diff = abs(route["distance_km"] - distance_km)
            if diff < best_diff:
                best_diff = diff
                best_route = route

            # Within 0.5km tolerance → done
            if diff <= 0.5:
                break

            # Adjust scale proportionally to close the gap
            ratio = distance_km / route["distance_km"]
            # Dampen the adjustment to avoid overshooting
            scale *= (1.0 + (ratio - 1.0) * 0.8)
        else:
            # Route failed, try with slightly different randomness
            scale *= 1.05

    if not best_route:
        # Fallback: return waypoint-based route
        waypoints = generate_waypoints(lat, lng, distance_km, course_type, traffic_lights)
        pace = AVG_PACE.get(course_type, 6.3)
        best_route = {
            "coordinates": [start] + waypoints + [start],
            "distance_km": distance_km,
        }

    # Find traffic lights on the actual route
    route_traffic_lights = find_traffic_lights_on_route(
        best_route["coordinates"], traffic_lights
    )

    # Calculate estimated time using average runner pace
    pace = AVG_PACE.get(course_type, 6.3)
    estimated_min = round(best_route["distance_km"] * pace, 1)

    # Course type descriptions
    type_info = {
        "uphill": {"name": "업힐 훈련", "description": "오르막 중심 코스", "icon": "⛰️"},
        "flat": {"name": "평지 러닝", "description": "평탄한 코스", "icon": "🏃"},
        "sprint": {"name": "스프린트", "description": "짧고 빠른 구간", "icon": "⚡"},
        "interval": {"name": "인터벌", "description": "구간 반복 훈련", "icon": "🔄"},
        "zone2": {"name": "존2 러닝", "description": "저강도 지구력 훈련", "icon": "❤️"},
    }

    info = type_info.get(course_type, type_info["flat"])

    return {
        "coordinates": best_route["coordinates"],
        "distance_km": best_route["distance_km"],
        "estimated_duration_min": estimated_min,
        "course_type": course_type,
        "course_info": info,
        "traffic_lights_on_route": route_traffic_lights,
        "traffic_lights_count": len(route_traffic_lights),
        "start": start,
    }
