"""AWS Lambda entry point.

API Gateway (HTTP API) hands every request to this function as an event. Mangum
translates that event into a normal web request for our FastAPI app and translates
the answer back, so the exact same code runs locally (uvicorn) and on Lambda.

In the Lambda console set the handler to:  lambda_handler.handler
"""

from mangum import Mangum

from app.main import app

# lifespan="off": Lambda has no clean shutdown signal, so there is nothing to close.
handler = Mangum(app, lifespan="off")
