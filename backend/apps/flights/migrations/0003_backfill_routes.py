from django.db import migrations


def link_routes(apps, schema_editor):
    Airport = apps.get_model("flights", "Airport")
    Route = apps.get_model("flights", "Route")
    Flight = apps.get_model("flights", "Flight")
    alias = schema_editor.connection.alias
    for flight in Flight.objects.using(alias).iterator():
        if (
            not flight.origin
            or not flight.destination
            or flight.origin == flight.destination
        ):
            continue
        pair = []
        for field in ("origin", "destination"):
            code = getattr(flight, field)
            airport, _ = Airport.objects.using(alias).get_or_create(
                code=code,
                defaults={
                    "name": getattr(flight, f"{field}_airport") or code,
                    "city": getattr(flight, f"{field}_city") or code,
                },
            )
            pair.append(airport)
        route, _ = Route.objects.using(alias).get_or_create(
            origin=pair[0], destination=pair[1]
        )
        Flight.objects.using(alias).filter(pk=flight.pk).update(route=route)


class Migration(migrations.Migration):
    dependencies = [
        ("flights", "0002_airport_flight_demonstration_route_flight_route_and_more")
    ]
    operations = [migrations.RunPython(link_routes, migrations.RunPython.noop)]
