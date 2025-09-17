def handler(request):
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': '{"message": "API is working!"}'
    }
