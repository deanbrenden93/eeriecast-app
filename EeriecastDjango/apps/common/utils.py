from rest_framework.decorators import api_view
from rest_framework.response import Response

def strip_non_model_fields(data, model_class):
    """
    Utility function to strip non-model fields from data
    """
    model_fields = [field.name for field in model_class._meta.get_fields()]
    return {key: value for key, value in data.items() if key in model_fields}
