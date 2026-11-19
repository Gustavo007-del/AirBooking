import logging
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models.deletion import ProtectedError
from django.db import IntegrityError
from rest_framework.response import Response
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.views import exception_handler as drf_handler

logger = logging.getLogger(__name__)


class Conflict(APIException):
    status_code = 409
    default_detail = "This request conflicts with the current record."
    default_code = "conflict"


def first_message(value):
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        value = value.values()
    if isinstance(value, (list, tuple)) or hasattr(value, "__iter__"):
        for item in value:
            message = first_message(item)
            if message:
                return message
    return None


def exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        exc = ValidationError(getattr(exc, "message_dict", None) or exc.messages)
    if isinstance(exc, ProtectedError):
        exc = Conflict("This record is referenced by a booking and cannot be deleted.")
    elif isinstance(exc, IntegrityError):
        exc = Conflict(
            "The record conflicts with existing data. Refresh and try again."
        )
    response = drf_handler(exc, context)
    if response is not None:
        data = response.data
        detail = data.get("detail") if isinstance(data, dict) else None
        if not isinstance(detail, str):
            detail = first_message(data) or "Please check the submitted fields."
        response.data = {
            "detail": detail,
            "code": getattr(exc, "default_code", "error"),
            "errors": data,
        }
    else:
        logger.exception("Unhandled API failure (%s)", type(exc).__name__)
        response = Response(
            {
                "detail": "An unexpected server error occurred.",
                "code": "server_error",
                "errors": {},
            },
            status=500,
        )
    return response
