from django.core.validators import RegexValidator

iata = RegexValidator(r"^[A-Z]{3}$", "Use a three-letter uppercase IATA airport code.")
currency_code = RegexValidator(
    r"^[A-Z]{3}$", "Use a three-letter uppercase currency code."
)
