import uuid
from decimal import Decimal
from django.db import models
from django.db.models import Q, F
from django.core.validators import MinValueValidator
from common.validators import iata, currency_code

CABINS = {
    "Economy": Decimal("1"),
    "Premium economy": Decimal("1.5"),
    "Business": Decimal("2.8"),
}
STATUSES = [
    (s, s)
    for s in ["Scheduled", "On time", "Delayed", "Cancelled", "Departed", "Arrived"]
]


class Airport(models.Model):
    code = models.CharField(max_length=3, unique=True, validators=[iata])
    name = models.CharField(max_length=160)
    city = models.CharField(max_length=100)
    country = models.CharField(max_length=100, blank=True)
    region = models.CharField(max_length=120, blank=True)
    timezone = models.CharField(max_length=64, default="UTC")
    latitude = models.DecimalField(
        max_digits=8, decimal_places=5, null=True, blank=True
    )
    longitude = models.DecimalField(
        max_digits=8, decimal_places=5, null=True, blank=True
    )
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} — {self.city}"


class Route(models.Model):
    origin = models.ForeignKey(
        Airport, on_delete=models.PROTECT, related_name="outbound_routes"
    )
    destination = models.ForeignKey(
        Airport, on_delete=models.PROTECT, related_name="inbound_routes"
    )
    active = models.BooleanField(default=True)
    distance_km = models.PositiveIntegerField(null=True, blank=True)
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(
                fields=["origin", "destination"], name="route_airport_pair"
            ),
            models.CheckConstraint(
                condition=~Q(origin=F("destination")), name="route_distinct_airports"
            ),
        ]


class Flight(models.Model):
    route = models.ForeignKey(
        Route, on_delete=models.PROTECT, related_name="flights", null=True, blank=True
    )
    demonstration = models.BooleanField(default=False)
    schedule_source = models.CharField(max_length=24, default="database")
    aircraft = models.JSONField(default=dict, blank=True)
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    airline = models.CharField(max_length=120)
    airline_code = models.CharField(max_length=3, blank=True)
    number = models.CharField(max_length=16, db_index=True)
    origin = models.CharField(max_length=3, validators=[iata], db_index=True)
    origin_airport = models.CharField(max_length=160, blank=True)
    origin_city = models.CharField(max_length=100, blank=True)
    destination = models.CharField(max_length=3, validators=[iata], db_index=True)
    destination_airport = models.CharField(max_length=160, blank=True)
    destination_city = models.CharField(max_length=100, blank=True)
    departure_datetime = models.DateTimeField(db_index=True)
    arrival_datetime = models.DateTimeField()
    price = models.DecimalField(
        max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    currency = models.CharField(max_length=3, default="INR", validators=[currency_code])
    total_seats = models.PositiveIntegerField()
    available_seats = models.PositiveIntegerField()
    stops = models.PositiveSmallIntegerField(default=0)
    status = models.CharField(
        max_length=16, choices=STATUSES, default="Scheduled", db_index=True
    )
    status_source = models.CharField(max_length=24, default="manual")
    status_updated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["departure_datetime", "id"]
        indexes = [
            models.Index(
                fields=["origin", "destination", "departure_datetime"],
                name="flight_route_depart_idx",
            )
        ]
        constraints = [
            models.CheckConstraint(
                condition=~Q(origin=F("destination")), name="flight_different_airports"
            ),
            models.CheckConstraint(
                condition=Q(arrival_datetime__gt=F("departure_datetime")),
                name="flight_arrival_after_departure",
            ),
            models.CheckConstraint(
                condition=Q(price__gt=0), name="flight_positive_price"
            ),
            models.CheckConstraint(
                condition=Q(total_seats__gt=0), name="flight_positive_capacity"
            ),
            models.CheckConstraint(
                condition=Q(available_seats__lte=F("total_seats")),
                name="flight_seat_capacity",
            ),
            models.UniqueConstraint(
                fields=["number", "departure_datetime"],
                name="flight_number_depart_unique",
            ),
        ]

    def fare(self, cabin="Economy"):
        return (self.price * CABINS[cabin]).quantize(Decimal("0.01"))

    def __str__(self):
        return f"{self.number} {self.departure_datetime}"
