from rest_framework import serializers


class PaymentRequestSerializer(serializers.Serializer):
    outcome = serializers.ChoiceField(choices=["success", "failure"], default="success")
