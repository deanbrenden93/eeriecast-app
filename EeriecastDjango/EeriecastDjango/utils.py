from django.http import HttpResponse, HttpResponseBadRequest


def strip_non_model_fields(data, model):
    """
    Remove any additional fields (i.e. those added onto a serializer) to format data for a model
    :param data:
    :param model:
    :return:
    """
    return dict([(key, val) for key, val in data.items() if key in [f.name for f in model._meta.get_fields()]])


# def get_presigned_url(key):
#     """
#     Get a presigned URL for an S3 object.
#     """
#     try:
#         # Generate a presigned URL for the S3 object with the specified key
#         presigned_url = s3.generate_presigned_url(
#             ClientMethod='get_object',
#             Params={'Bucket': settings.AWS_STORAGE_BUCKET_NAME, 'Key': key},
#             ExpiresIn=3600  # URL expiration time in seconds
#         )
#         return presigned_url
#     except Exception as e:
#         # Return an error response if the presigned URL cannot be generated
#         raise ValueError(str(e))
